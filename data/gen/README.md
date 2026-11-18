# STARE-Gen: the model trained in this project

STARE-Gen writes one sentence stating the rule of law that a source passage supports. It is
`HuggingFaceTB/SmolLM2-135M-Instruct` (135M parameters) fine-tuned on examples taken from STARE's own corpus of
federal employment-discrimination opinions. Code: `backend/stare/gen/`.

## Training data (`stare gen data`)

When a court cites an earlier case, it usually first states the rule it takes from it: "A plaintiff must show
... . See Burlington N. & Santa Fe Ry. Co. v. White, 548 U.S. 53 (2006)." Each citation edge in the corpus stores
the citing court's text around the citation. From those:

| Step | Count |
|---|---|
| Citation edges with stored context | 68,066 |
| Rule sentences written just before a citation (filters: one plain sentence, 60 to 320 characters, a rule verb, no other citation, no first person, no party or procedural words) | 10,168 |
| Kept: the cited opinion has a passage containing at least 50% of the sentence's content words | 4,937 (from 2,144 cited opinions) |
| Split by cited opinion (no test passage comes from an opinion seen in training) | train 4,500, dev 217, test 200 |

Each example is `source` (about 140 words of the cited opinion), `case` and `target` (the citing court's sentence).
No text was written by hand.

## Training (`stare gen train`)

Plain PyTorch loop on the Apple GPU of an 8 GB laptop: only the target tokens are scored; one example per forward
pass, 16 per update; Adafactor with a frozen embedding matrix to save memory; learning rate 1e-4 with warm-up and
cosine decay; sequences up to 384 tokens (3,838 of the 4,500 training examples fit). One pass of 239 updates took
44 minutes. Dev loss fell from 2.854 (base model) to 2.407. The best checkpoint is stored in bfloat16 in
`models/stare-gen/` (about 270 MB, not committed; rebuild with the two commands above).

## Evaluation (`stare gen eval`, `eval_results.json`)

200 held-out passages, greedy decoding:

| Model | ROUGE-L F1 against the court's sentence | Passes the grounding check | Content words found in the source | Words | Seconds per sentence |
|---|---|---|---|---|---|
| Base SmolLM2-135M-Instruct | 0.149 | 14.0% | 0.359 | 31.4 | 0.91 |
| **STARE-Gen** | **0.175** | **29.0%** | **0.451** | 20.8 | 0.34 |
| The court's own sentence (reference) | 1.000 | 64.5% | 0.685 | 25.5 | — |

The grounding check accepts a sentence only if it is one plain sentence, cites nothing itself and at least 60% of
its content words appear in the source (the Memo Agent requires 70%). Fine-tuning doubled the share of usable,
grounded sentences and brought the wording closer to the courts'. Reading the samples, though, a 135M model still
misstates some rules even when it uses the source's words, which a word-overlap check cannot detect.

## How STARE uses it

Off by default. With `STARE_MEMO_WRITER=stare_gen`, the Memo Agent adds, for each verified case authority, a
sentence labelled "Summary (STARE-Gen)" before the verified quotation from that authority; a sentence that fails
the grounding check is dropped. On the sample complaint STARE-Gen proposed nine sentences, three
passed and six were dropped (memo ready in about 26 seconds instead of 19). Citations and quotations are still attached by code and checked by the Citation
Firewall, so STARE-Gen cannot add a citation to a memo.
