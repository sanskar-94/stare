"""STARE-Gen at inference: one rule sentence from one verified passage.

Greedy decoding (deterministic), repetition penalty 1.1, at most 80 new tokens; only the first sentence is kept.
The caller must still pass the result through `prompt.acceptable` (the grounding check) before using it.
"""

from __future__ import annotations

import logging
import os
import re
import threading
from functools import lru_cache
from pathlib import Path

from stare.gen.prompt import messages

log = logging.getLogger(__name__)
_FIRST_SENTENCE = re.compile(r"^(.+?[.!?])(?:\s+[A-Z(\"“]|$)", re.DOTALL)


class StareGen:
    name = "STARE-Gen"

    def __init__(self, path: Path | str, device: str | None = None):
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from stare._quiet import quiet_ml_imports

        quiet_ml_imports()
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.device = device or ("mps" if torch.backends.mps.is_available() else "cpu")
        self.tok = AutoTokenizer.from_pretrained(str(path))
        self.model = AutoModelForCausalLM.from_pretrained(str(path), torch_dtype=torch.float32).to(self.device).eval()
        self.lock = threading.Lock()  # one generation at a time (the API server may call from several threads)

    def write(self, source: str, case_name: str = "", max_new_tokens: int = 80) -> str:
        prompt = self.tok.apply_chat_template(messages(source, case_name), add_generation_prompt=True, tokenize=False)
        ids = self.tok(prompt, return_tensors="pt", add_special_tokens=False).input_ids.to(self.device)
        with self.lock, self.torch.no_grad():
            out = self.model.generate(ids, max_new_tokens=max_new_tokens, do_sample=False, repetition_penalty=1.1,
                                      pad_token_id=self.tok.eos_token_id)
        text = self.tok.decode(out[0, ids.shape[1]:], skip_special_tokens=True).strip()
        m = _FIRST_SENTENCE.match(" ".join(text.split()))
        return m.group(1).strip() if m else " ".join(text.split())


@lru_cache(maxsize=2)
def _load(path: str) -> StareGen | None:
    try:
        return StareGen(Path(path))
    except Exception as exc:  # noqa: BLE001 - missing weights or no PyTorch: the memo is drafted extractively
        log.warning("STARE-Gen not available (%s); using the extractive memo writer", exc)
        return None


def get_writer(settings) -> StareGen | None:
    """The trained writer when the settings ask for it (or 'auto' and the model folder exists), else None."""
    mode = settings.memo_writer
    path = Path(settings.gen_model_dir)
    if mode == "extractive" or (mode == "auto" and not (path / "config.json").exists()):
        return None
    return _load(str(path))
