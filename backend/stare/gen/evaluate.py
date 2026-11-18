"""Evaluate STARE-Gen against the untrained base model on the held-out test pairs.

Metrics per model, over the test passages (from cited opinions never seen in training):

* ROUGE-L F1 against the sentence the citing court actually wrote;
* grounding pass rate: share of outputs that pass `prompt.acceptable` (one plain sentence, no citation of its
  own, at least 60% of its content words found in the source passage), i.e. would be used in a memo;
* mean support: average share of content words found in the source;
* mean length in words.
"""

from __future__ import annotations

import json
import os
import time
from collections.abc import Callable

from stare.gen.data import GEN_DIR
from stare.gen.prompt import acceptable, support
from stare.gen.train import BASE_MODEL, MODEL_DIR, load_jsonl


def _lcs(a: list[str], b: list[str]) -> int:
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[-1]))
        prev = cur
    return prev[-1]


def rouge_l(pred: str, ref: str) -> float:
    p, r = pred.lower().split(), ref.lower().split()
    if not p or not r:
        return 0.0
    lcs = _lcs(p, r)
    if not lcs:
        return 0.0
    prec, rec = lcs / len(p), lcs / len(r)
    return 2 * prec * rec / (prec + rec)


def score(rows: list[dict], outputs: list[str]) -> dict:
    n = len(rows)
    return {
        "examples": n,
        "rouge_l_f1": round(sum(rouge_l(o, r["target"]) for o, r in zip(outputs, rows)) / n, 4),
        "grounding_pass_rate": round(sum(acceptable(o, r["source"]) for o, r in zip(outputs, rows)) / n, 4),
        "mean_support": round(sum(support(o, r["source"]) for o, r in zip(outputs, rows)) / n, 4),
        "mean_words": round(sum(len(o.split()) for o in outputs) / n, 1),
    }


def evaluate(limit: int = 200, say: Callable[[str], None] = print) -> dict:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    from stare.gen.writer import StareGen

    rows = load_jsonl(GEN_DIR / "test.jsonl")[:limit]
    result = {"test_examples": len(rows), "reference": score(rows, [r["target"] for r in rows])}
    samples = []
    for label, path in (("base", BASE_MODEL), ("stare_gen", str(MODEL_DIR))):
        model = StareGen(path)
        t0 = time.time()
        outs = []
        for i, r in enumerate(rows, 1):
            outs.append(model.write(r["source"], r.get("case", "")))
            if i % 50 == 0:
                say(f"  {label}: {i}/{len(rows)}")
        result[label] = score(rows, outs) | {"seconds_per_sentence": round((time.time() - t0) / len(rows), 2)}
        say(f"{label}: {result[label]}")
        samples.append(outs)
        del model
    result["samples"] = [{"case": r.get("case", ""), "reference": r["target"], "base": b, "stare_gen": g}
                         for r, b, g in list(zip(rows, samples[0], samples[1]))[:12]]
    (GEN_DIR / "eval_results.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    return {k: v for k, v in result.items() if k != "samples"}
