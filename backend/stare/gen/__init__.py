"""STARE-Gen: the small memo-writing model trained in this project.

SmolLM2-135M-Instruct, fine-tuned on pairs taken from real federal opinions: a passage of a cited opinion (input)
and the sentence in which a later court stated the rule it took from that opinion (target). In the Memo Agent it
writes one rule sentence per verified case authority; the citation and the verified quotation are attached by
code, a grounding check rejects any sentence the passage does not support, and the Citation Firewall still checks
every citation. Training and evaluation: `stare gen data`, `stare gen train`, `stare gen eval`.
"""
