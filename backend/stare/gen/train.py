"""Fine-tune SmolLM2-135M-Instruct into STARE-Gen.

A plain PyTorch loop sized for an 8 GB laptop:

1. Each example is the chat prompt (rules + source passage) followed by the target rule sentence. Only the
   target tokens are scored (prompt positions get label -100), so the model learns to write the rule, not to
   copy the prompt.
2. One example per forward pass, `accum` passes per optimiser update; Adafactor (no Adam moment buffers) and a
   frozen embedding matrix keep memory low.
3. Linear warm-up then cosine decay; gradient clipping at 1.0.
4. Every `eval_every` updates the dev loss is measured and the best checkpoint is saved; a time budget stops the
   run cleanly. The best checkpoint is stored in bfloat16 in models/stare-gen/ (about 270 MB).
"""

from __future__ import annotations

import json
import math
import os
import random
import time
from collections.abc import Callable
from pathlib import Path

from stare.config import REPO_DIR
from stare.gen.data import GEN_DIR
from stare.gen.prompt import messages

BASE_MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct"
MODEL_DIR = REPO_DIR / "models" / "stare-gen"
END = "<|im_end|>"


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def encode(tok, ex: dict, max_len: int):
    import torch

    prompt = tok.apply_chat_template(messages(ex["source"], ex.get("case", "")), add_generation_prompt=True,
                                     tokenize=False)
    p_ids = tok(prompt, add_special_tokens=False).input_ids
    a_ids = tok(ex["target"] + END, add_special_tokens=False).input_ids
    if len(p_ids) + len(a_ids) > max_len:
        return None
    return torch.tensor([p_ids + a_ids]), torch.tensor([[-100] * len(p_ids) + a_ids])


def lr_at(step: int, total: int, warmup: int, peak: float) -> float:
    if step < warmup:
        return peak * (step + 1) / warmup
    progress = (step - warmup) / max(1, total - warmup)
    return peak * 0.5 * (1 + math.cos(math.pi * min(1.0, progress)))


def device_name() -> str:
    import torch

    return "mps" if torch.backends.mps.is_available() else "cpu"


def dev_loss(model, batch, device) -> float:
    import torch

    model.eval()
    total, n = 0.0, 0
    with torch.no_grad():
        for ids, labels in batch:
            out = model(input_ids=ids.to(device), labels=labels.to(device))
            total += float(out.loss)
            n += 1
    model.train()
    return total / max(1, n)


def train(*, examples: int = 2400, accum: int = 16, lr: float = 1e-4, eval_every: int = 25, max_len: int = 384,
          dev_n: int = 100, max_minutes: float = 110.0, seed: int = 0, out_dir: Path | None = None,
          say: Callable[[str], None] = print) -> dict:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    out = out_dir or MODEL_DIR
    random.seed(seed)
    torch.manual_seed(seed)
    device = device_name()
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float32).to(device)
    model.get_input_embeddings().weight.requires_grad_(False)  # tied with the output layer: frozen
    model.gradient_checkpointing_enable()
    model.config.use_cache = False
    trainable = [p for p in model.parameters() if p.requires_grad]

    train_rows = load_jsonl(GEN_DIR / "train.jsonl")
    dev_rows = load_jsonl(GEN_DIR / "dev.jsonl")
    train_set = [e for e in (encode(tok, r, max_len) for r in train_rows) if e is not None][:examples]
    dev_set = [e for e in (encode(tok, r, max_len) for r in dev_rows) if e is not None][:dev_n]
    updates = len(train_set) // accum
    warmup = max(1, updates // 10)
    opt = torch.optim.Adafactor(trainable, lr=lr, weight_decay=0.0)
    say(f"device {device}; {sum(p.numel() for p in trainable) / 1e6:.1f}M trainable parameters; "
        f"{len(train_set)} training examples, {updates} updates of {accum}; {len(dev_set)} dev examples")

    log = {"base_model": BASE_MODEL, "device": device, "examples": len(train_set), "accum": accum, "lr": lr,
           "max_len": max_len, "updates_planned": updates, "checks": []}
    best = dev_loss(model, dev_set, device)
    log["checks"].append({"update": 0, "dev_loss": round(best, 4), "minutes": 0.0})
    say(f"update 0: dev loss {best:.4f}")
    start = time.time()
    step = 0
    model.train()
    stopped = "completed"
    for u in range(updates):
        for g in opt.param_groups:
            g["lr"] = lr_at(u, updates, warmup, lr)
        opt.zero_grad(set_to_none=True)
        batch_loss = 0.0
        for ids, labels in train_set[step:step + accum]:
            loss = model(input_ids=ids.to(device), labels=labels.to(device)).loss / accum
            loss.backward()
            batch_loss += float(loss)
        step += accum
        torch.nn.utils.clip_grad_norm_(trainable, 1.0)
        opt.step()
        minutes = (time.time() - start) / 60
        if (u + 1) % eval_every == 0 or u + 1 == updates:
            d = dev_loss(model, dev_set, device)
            log["checks"].append({"update": u + 1, "train_loss": round(batch_loss, 4), "dev_loss": round(d, 4),
                                  "minutes": round(minutes, 1)})
            say(f"update {u + 1}/{updates}: train {batch_loss:.4f} dev {d:.4f} ({minutes:.1f} min)")
            if d < best:
                best = d
                half = {k: v.detach().to("cpu", torch.bfloat16) for k, v in model.state_dict().items()}
                model.save_pretrained(out, state_dict=half, safe_serialization=True)
                tok.save_pretrained(out)
                del half
                log["best_update"] = u + 1
            (GEN_DIR / "training_log.json").write_text(json.dumps(log, indent=2) + "\n")
        if minutes > max_minutes:
            stopped = f"time budget ({max_minutes} min) reached after {u + 1} updates"
            break
    log["stopped"] = stopped
    log["best_dev_loss"] = round(best, 4)
    log["minutes"] = round((time.time() - start) / 60, 1)

    del model, opt
    (GEN_DIR / "training_log.json").write_text(json.dumps(log, indent=2) + "\n")
    return {k: log[k] for k in ("examples", "best_dev_loss", "minutes", "stopped") if k in log} | {
        "dev_loss_before": log["checks"][0]["dev_loss"], "saved_to": str(out)}
