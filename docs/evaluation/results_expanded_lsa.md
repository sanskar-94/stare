# STARE evaluation results

Generated 2026-11-18T08:17:10+00:00 with LLM provider `offline`, embedder `lsa`, reranker `lexical`, on 100 gold questions (0 errors). Corpus: 5,120 opinions, 177 statute and regulation sections, 103,977 search chunks.

| Metric | Result | Target (Table 29) |
|---|---|---|
| Mata fixture: fabricated citations blocked | 6 of 6 non-exportable (3 blocked, 3 unresolved) | 6 of 6 |
| Unverified citations in exported memos | 0 | 0 |
| Citation accuracy (automated): kept memo citations that exist and whose quotations match, verified or warning (1434 kept) | 1.000 | ≥ 0.94 |
| Citation accuracy (automated, strict): kept memo citations fully verified, no warning (1377 verified, 57 warning) | 0.960 | — |
| Hallucination rate: citations the drafter wrote that the memo Firewall blocked or left unresolved (0 of 834) | 0.000 | ≤ 0.02 |
| Retrieval recall@10 | 0.780 | ≥ 0.80 |
| Redaction coverage (auto engine) | 100.0% (27/27) | 100% |
| Redaction coverage (regex-only engine) | 96.3% (26/27) | — |
| Latency, approved plan to memo (p95) | 10.437 s | < 90 s |
| Citation accuracy, reviewed: exists **and supports the statement** (74 citations from the offline run on the 151-opinion seed corpus, 20 October 2026, [support_review.md](support_review.md)) | 0.986 | ≥ 0.94 |
| Hallucination rate, reviewed: citations that do not support their statement | 0.014 | ≤ 0.02 |
| Baseline comparison: citation accuracy, general-purpose LLM without retrieval (`opencode/beam-free (free general-purpose LLM, no retrieval)`, 100 questions, 563 citations) | 0.977 (STARE 1.000) | STARE higher |
| Baseline accuracy over citations the Firewall could check (3 unresolved excluded) | 0.982 | — |
| Baseline citations blocked as nonexistent or misquoted | 7 of 563 | — |

Notes:
- Citation counts are per occurrence. The automated accuracy is measured over the citations left in the final memos, after the Firewall removed failing ones, so it counts warnings (e.g. a near-match quotation or good-law status not checked) as accurate; the strict row counts only fully verified citations. The hallucination rate counts the citations the drafter (the LLM, or the offline extractive drafter) wrote in the issue, rule, application and conclusion, before the memo Firewall pass; the question presented and the adverse-authority list are not drafted (they come from the gold question and the Firewall-checked adverse authorities). `hallucination_rate` in results.json keeps the earlier definition for comparison with older reports.
- The automated citation accuracy checks that each citation exists in court records and every quotation matches the opinion; the reviewed rows add whether each authority supports its statement (the Table 29 manual check of a 20-question sample, every verdict listed in support_review.md; validation with practising lawyers is future scope, Section 7.4).
- In offline mode the memo is drafted extractively from verified passages, so the hallucination rate measures the pipeline's guarantees. The baseline rows score a free general-purpose LLM answering the same questions without retrieval (`stare eval baseline --answers`); citations the free CourtListener API could not check (rate limit) are counted as unresolved.

## Per-question results

| Question | recall@10 | memo citations | verified | removed | export violations | latency (s) | missed expected |
|---|---|---|---|---|---|---|---|
| G001 | 1.000 | 16 | 16 | 0 | 0 | 14.373 | — |
| G002 | 1.000 | 16 | 16 | 0 | 0 | 11.999 | — |
| G003 | 1.000 | 16 | 16 | 0 | 0 | 5.948 | — |
| G004 | 1.000 | 16 | 16 | 0 | 0 | 5.179 | — |
| G005 | 1.000 | 16 | 16 | 0 | 0 | 7.165 | — |
| G006 | 0.500 | 16 | 16 | 0 | 0 | 12.282 | 104 F.3d 702 |
| G007 | 1.000 | 16 | 16 | 0 | 0 | 9.402 | — |
| G008 | 1.000 | 16 | 16 | 0 | 0 | 5.583 | — |
| G009 | 1.000 | 16 | 16 | 0 | 0 | 5.698 | — |
| G010 | 1.000 | 16 | 16 | 0 | 0 | 5.56 | — |
| G011 | 1.000 | 16 | 16 | 0 | 0 | 5.038 | — |
| G012 | 0.000 | 16 | 16 | 0 | 0 | 5.724 | 492 F.3d 551, 42 U.S.C. § 2000e-3 |
| G013 | 0.000 | 16 | 16 | 0 | 0 | 5.44 | 42 U.S.C. § 2000e-3 |
| G014 | 1.000 | 16 | 16 | 0 | 0 | 5.807 | — |
| G015 | 1.000 | 16 | 16 | 0 | 0 | 5.742 | — |
| G016 | 0.500 | 16 | 16 | 0 | 0 | 5.466 | 281 F.3d 1054 |
| G017 | 1.000 | 16 | 16 | 0 | 0 | 4.826 | — |
| G018 | 0.000 | 16 | 16 | 0 | 0 | 5.436 | 532 U.S. 268 |
| G019 | 0.500 | 16 | 16 | 0 | 0 | 5.038 | 42 U.S.C. § 2000e-3 |
| G020 | 0.000 | 16 | 16 | 0 | 0 | 5.371 | 530 U.S. 133, 570 U.S. 338 |
| G021 | 1.000 | 14 | 13 | 0 | 0 | 6.995 | — |
| G022 | 1.000 | 14 | 13 | 0 | 0 | 5.732 | — |
| G023 | 1.000 | 14 | 13 | 0 | 0 | 6.203 | — |
| G024 | 1.000 | 14 | 13 | 0 | 0 | 5.938 | — |
| G025 | 1.000 | 14 | 13 | 0 | 0 | 5.948 | — |
| G026 | 1.000 | 14 | 13 | 0 | 0 | 5.725 | — |
| G027 | 1.000 | 14 | 13 | 0 | 0 | 5.618 | — |
| G028 | 0.500 | 13 | 12 | 0 | 0 | 5.952 | 539 U.S. 90 |
| G029 | 1.000 | 13 | 12 | 0 | 0 | 5.679 | — |
| G030 | 1.000 | 14 | 13 | 0 | 0 | 10.436 | — |
| G031 | 1.000 | 14 | 13 | 0 | 0 | 7.243 | — |
| G032 | 1.000 | 14 | 13 | 0 | 0 | 6.181 | — |
| G033 | 1.000 | 13 | 12 | 0 | 0 | 5.487 | — |
| G034 | 0.500 | 14 | 13 | 0 | 0 | 5.873 | 245 F.3d 507 |
| G035 | 1.000 | 14 | 13 | 0 | 0 | 5.788 | — |
| G036 | 0.500 | 14 | 13 | 0 | 0 | 6.098 | 492 F.3d 551 |
| G037 | 1.000 | 14 | 13 | 0 | 0 | 10.457 | — |
| G038 | 1.000 | 14 | 13 | 0 | 0 | 6.419 | — |
| G039 | 0.000 | 14 | 13 | 0 | 0 | 6.423 | 401 U.S. 424 |
| G040 | 1.000 | 13 | 12 | 0 | 0 | 5.448 | — |
| G041 | 0.500 | 14 | 13 | 0 | 0 | 5.799 | 349 F.3d 634 |
| G042 | 1.000 | 14 | 13 | 0 | 0 | 6.24 | — |
| G043 | 1.000 | 14 | 13 | 0 | 0 | 4.526 | — |
| G044 | 1.000 | 14 | 13 | 0 | 0 | 5.522 | — |
| G045 | 1.000 | 14 | 13 | 0 | 0 | 7.946 | — |
| G046 | 1.000 | 14 | 14 | 0 | 0 | 10.488 | — |
| G047 | 1.000 | 13 | 12 | 0 | 0 | 6.163 | — |
| G048 | 1.000 | 14 | 13 | 0 | 0 | 6.048 | — |
| G049 | 1.000 | 14 | 14 | 0 | 0 | 5.16 | — |
| G050 | 1.000 | 13 | 12 | 0 | 0 | 5.594 | — |
| G051 | 1.000 | 13 | 12 | 0 | 0 | 5.723 | — |
| G052 | 1.000 | 14 | 14 | 0 | 0 | 5.248 | — |
| G053 | 1.000 | 13 | 13 | 0 | 0 | 6.187 | — |
| G054 | 0.500 | 14 | 13 | 0 | 0 | 6.502 | 731 F.3d 444 |
| G055 | 1.000 | 14 | 14 | 0 | 0 | 5.004 | — |
| G056 | 0.500 | 13 | 13 | 0 | 0 | 4.616 | 419 F.3d 885 |
| G057 | 0.500 | 14 | 14 | 0 | 0 | 5.65 | 360 F.3d 1103 |
| G058 | 0.500 | 13 | 12 | 0 | 0 | 5.825 | 570 U.S. 421 |
| G059 | 1.000 | 14 | 13 | 0 | 0 | 6.062 | — |
| G060 | 0.000 | 14 | 14 | 0 | 0 | 5.661 | 542 U.S. 129, 578 U.S. 547 |
| G061 | 1.000 | 14 | 12 | 0 | 0 | 4.758 | — |
| G062 | 1.000 | 14 | 12 | 0 | 0 | 3.472 | — |
| G063 | 1.000 | 14 | 13 | 0 | 0 | 4.169 | — |
| G064 | 0.500 | 14 | 12 | 0 | 0 | 3.185 | 358 F.3d 599 |
| G065 | 1.000 | 13 | 12 | 0 | 0 | 4.139 | — |
| G066 | 1.000 | 14 | 12 | 0 | 0 | 3.521 | — |
| G067 | 0.500 | 14 | 13 | 0 | 0 | 5.529 | 42 U.S.C. § 2000e-5 |
| G068 | 1.000 | 14 | 13 | 0 | 0 | 5.406 | — |
| G069 | 0.000 | 14 | 13 | 0 | 0 | 4.893 | 587 U.S. 541 |
| G070 | 1.000 | 14 | 14 | 0 | 0 | 5.622 | — |
| G071 | 1.000 | 16 | 16 | 0 | 0 | 5.443 | — |
| G072 | 0.000 | 14 | 13 | 0 | 0 | 5.734 | 42 U.S.C. § 2000e-5 |
| G073 | 1.000 | 14 | 13 | 0 | 0 | 4.074 | — |
| G074 | 1.000 | 14 | 13 | 0 | 0 | 3.939 | — |
| G075 | 1.000 | 14 | 14 | 0 | 0 | 3.444 | — |
| G076 | 1.000 | 14 | 13 | 0 | 0 | 3.429 | — |
| G077 | 1.000 | 14 | 14 | 0 | 0 | 3.423 | — |
| G078 | 0.000 | 14 | 13 | 0 | 0 | 3.393 | 42 U.S.C. § 12111 |
| G079 | 1.000 | 14 | 14 | 0 | 0 | 3.751 | — |
| G080 | 1.000 | 14 | 13 | 0 | 0 | 3.735 | — |
| G081 | 0.000 | 14 | 14 | 0 | 0 | 2.878 | 42 U.S.C. § 12112, 29 C.F.R. § 1630.2 |
| G082 | 1.000 | 14 | 14 | 0 | 0 | 3.253 | — |
| G083 | 0.500 | 14 | 14 | 0 | 0 | 2.944 | 29 C.F.R. § 1630.2 |
| G084 | 1.000 | 14 | 14 | 0 | 0 | 2.93 | — |
| G085 | 1.000 | 14 | 14 | 0 | 0 | 2.87 | — |
| G086 | 0.000 | 14 | 13 | 0 | 0 | 3.891 | 42 U.S.C. § 12111 |
| G087 | 0.000 | 14 | 14 | 0 | 0 | 6.521 | 511 F.3d 974 |
| G088 | 1.000 | 17 | 17 | 0 | 0 | 2.417 | — |
| G089 | 0.000 | 14 | 14 | 0 | 0 | 2.954 | 29 C.F.R. § 1630.2 |
| G090 | 1.000 | 14 | 14 | 0 | 0 | 4.817 | — |
| G091 | 1.000 | 14 | 13 | 0 | 0 | 3.76 | — |
| G092 | 1.000 | 14 | 14 | 0 | 0 | 4.406 | — |
| G093 | 1.000 | 14 | 13 | 0 | 0 | 4.397 | — |
| G094 | 1.000 | 14 | 14 | 0 | 0 | 3.105 | — |
| G095 | 1.000 | 14 | 13 | 0 | 0 | 3.756 | — |
| G096 | 1.000 | 14 | 14 | 0 | 0 | 4.158 | — |
| G097 | 1.000 | 14 | 13 | 0 | 0 | 3.64 | — |
| G098 | 1.000 | 14 | 14 | 0 | 0 | 3.38 | — |
| G099 | 0.000 | 14 | 14 | 0 | 0 | 4.928 | 530 U.S. 133, 309 F.3d 893 |
| G100 | 0.000 | 14 | 13 | 0 | 0 | 3.786 | 29 U.S.C. § 631 |
