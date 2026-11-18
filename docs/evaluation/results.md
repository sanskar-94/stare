# STARE evaluation results

Generated 2026-11-18T14:47:33+00:00 with LLM provider `offline`, embedder `sentence_transformers`, reranker `lexical`, on 100 gold questions (0 errors). Corpus: 5,120 opinions, 177 statute and regulation sections, 103,977 search chunks.

| Metric | Result | Target (Table 29) |
|---|---|---|
| Mata fixture: fabricated citations blocked | 6 of 6 non-exportable (3 blocked, 3 unresolved) | 6 of 6 |
| Unverified citations in exported memos | 0 | 0 |
| Citation accuracy (automated): kept memo citations that exist and whose quotations match, verified or warning (1429 kept) | 1.000 | ≥ 0.94 |
| Citation accuracy (automated, strict): kept memo citations fully verified, no warning (1346 verified, 83 warning) | 0.942 | — |
| Hallucination rate: citations the drafter wrote that the memo Firewall blocked or left unresolved (0 of 829) | 0.000 | ≤ 0.02 |
| Retrieval recall@10 | 0.790 | ≥ 0.80 |
| Redaction coverage (auto engine) | 100.0% (27/27) | 100% |
| Redaction coverage (regex-only engine) | 96.3% (26/27) | — |
| Latency, approved plan to memo (p95) | 22.365 s | < 90 s |
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
| G001 | 1.000 | 16 | 15 | 0 | 0 | 28.734 | — |
| G002 | 1.000 | 17 | 16 | 0 | 0 | 6.911 | — |
| G003 | 1.000 | 16 | 15 | 0 | 0 | 6.402 | — |
| G004 | 1.000 | 17 | 16 | 0 | 0 | 44.464 | — |
| G005 | 1.000 | 16 | 15 | 0 | 0 | 13.363 | — |
| G006 | 1.000 | 15 | 14 | 0 | 0 | 11.112 | — |
| G007 | 1.000 | 16 | 15 | 0 | 0 | 22.358 | — |
| G008 | 1.000 | 17 | 16 | 0 | 0 | 10.42 | — |
| G009 | 1.000 | 17 | 16 | 0 | 0 | 40.779 | — |
| G010 | 1.000 | 16 | 15 | 0 | 0 | 6.101 | — |
| G011 | 1.000 | 17 | 16 | 0 | 0 | 15.963 | — |
| G012 | 0.000 | 16 | 15 | 0 | 0 | 6.627 | 492 F.3d 551, 42 U.S.C. § 2000e-3 |
| G013 | 0.000 | 16 | 15 | 0 | 0 | 6.606 | 42 U.S.C. § 2000e-3 |
| G014 | 1.000 | 16 | 15 | 0 | 0 | 12.005 | — |
| G015 | 1.000 | 15 | 14 | 0 | 0 | 6.012 | — |
| G016 | 0.500 | 17 | 16 | 0 | 0 | 7.808 | 281 F.3d 1054 |
| G017 | 1.000 | 17 | 16 | 0 | 0 | 8.538 | — |
| G018 | 0.000 | 16 | 15 | 0 | 0 | 33.941 | 532 U.S. 268 |
| G019 | 0.500 | 17 | 16 | 0 | 0 | 15.568 | 42 U.S.C. § 2000e-3 |
| G020 | 0.500 | 16 | 15 | 0 | 0 | 5.911 | 530 U.S. 133 |
| G021 | 1.000 | 13 | 12 | 0 | 0 | 7.688 | — |
| G022 | 1.000 | 14 | 13 | 0 | 0 | 7.959 | — |
| G023 | 1.000 | 13 | 12 | 0 | 0 | 7.504 | — |
| G024 | 1.000 | 13 | 12 | 0 | 0 | 15.561 | — |
| G025 | 1.000 | 13 | 12 | 0 | 0 | 16.994 | — |
| G026 | 1.000 | 14 | 13 | 0 | 0 | 16.975 | — |
| G027 | 1.000 | 14 | 13 | 0 | 0 | 11.723 | — |
| G028 | 1.000 | 12 | 11 | 0 | 0 | 15.382 | — |
| G029 | 1.000 | 13 | 12 | 0 | 0 | 5.49 | — |
| G030 | 1.000 | 13 | 12 | 0 | 0 | 6.197 | — |
| G031 | 1.000 | 13 | 12 | 0 | 0 | 7.193 | — |
| G032 | 1.000 | 14 | 13 | 0 | 0 | 5.546 | — |
| G033 | 1.000 | 13 | 12 | 0 | 0 | 5.931 | — |
| G034 | 0.500 | 13 | 12 | 0 | 0 | 7.394 | 245 F.3d 507 |
| G035 | 1.000 | 13 | 12 | 0 | 0 | 5.922 | — |
| G036 | 0.500 | 13 | 12 | 0 | 0 | 6.281 | 492 F.3d 551 |
| G037 | 1.000 | 14 | 13 | 0 | 0 | 6.41 | — |
| G038 | 1.000 | 13 | 12 | 0 | 0 | 7.132 | — |
| G039 | 1.000 | 13 | 12 | 0 | 0 | 6.74 | — |
| G040 | 1.000 | 13 | 12 | 0 | 0 | 5.349 | — |
| G041 | 0.500 | 14 | 13 | 0 | 0 | 6.708 | 349 F.3d 634 |
| G042 | 1.000 | 14 | 13 | 0 | 0 | 6.226 | — |
| G043 | 1.000 | 14 | 13 | 0 | 0 | 5.746 | — |
| G044 | 1.000 | 13 | 12 | 0 | 0 | 5.916 | — |
| G045 | 1.000 | 14 | 12 | 0 | 0 | 6.541 | — |
| G046 | 1.000 | 14 | 13 | 0 | 0 | 5.51 | — |
| G047 | 1.000 | 14 | 12 | 0 | 0 | 5.953 | — |
| G048 | 1.000 | 14 | 12 | 0 | 0 | 6.064 | — |
| G049 | 1.000 | 14 | 13 | 0 | 0 | 5.692 | — |
| G050 | 1.000 | 14 | 12 | 0 | 0 | 7.158 | — |
| G051 | 1.000 | 14 | 12 | 0 | 0 | 5.958 | — |
| G052 | 1.000 | 14 | 13 | 0 | 0 | 9.464 | — |
| G053 | 1.000 | 14 | 13 | 0 | 0 | 6.905 | — |
| G054 | 1.000 | 14 | 12 | 0 | 0 | 9.788 | — |
| G055 | 0.000 | 14 | 13 | 0 | 0 | 5.449 | 924 F.2d 872 |
| G056 | 0.500 | 14 | 14 | 0 | 0 | 5.082 | 419 F.3d 885 |
| G057 | 0.500 | 14 | 13 | 0 | 0 | 7.061 | 360 F.3d 1103 |
| G058 | 1.000 | 14 | 12 | 0 | 0 | 7.959 | — |
| G059 | 1.000 | 14 | 12 | 0 | 0 | 6.151 | — |
| G060 | 0.500 | 14 | 13 | 0 | 0 | 6.023 | 578 U.S. 547 |
| G061 | 1.000 | 14 | 13 | 0 | 0 | 5.159 | — |
| G062 | 1.000 | 14 | 13 | 0 | 0 | 4.105 | — |
| G063 | 1.000 | 14 | 13 | 0 | 0 | 4.399 | — |
| G064 | 0.500 | 14 | 13 | 0 | 0 | 3.988 | 358 F.3d 599 |
| G065 | 1.000 | 14 | 13 | 0 | 0 | 4.342 | — |
| G066 | 1.000 | 14 | 12 | 0 | 0 | 4.889 | — |
| G067 | 0.500 | 13 | 13 | 0 | 0 | 6.237 | 42 U.S.C. § 2000e-5 |
| G068 | 1.000 | 14 | 13 | 0 | 0 | 6.056 | — |
| G069 | 0.000 | 14 | 13 | 0 | 0 | 5.708 | 587 U.S. 541 |
| G070 | 1.000 | 13 | 13 | 0 | 0 | 5.58 | — |
| G071 | 1.000 | 17 | 17 | 0 | 0 | 6.778 | — |
| G072 | 0.000 | 13 | 12 | 0 | 0 | 6.2 | 42 U.S.C. § 2000e-5 |
| G073 | 1.000 | 14 | 13 | 0 | 0 | 4.895 | — |
| G074 | 0.000 | 13 | 13 | 0 | 0 | 9.684 | 42 U.S.C. § 12102 |
| G075 | 0.500 | 14 | 14 | 0 | 0 | 4.343 | 42 U.S.C. § 12102 |
| G076 | 0.500 | 13 | 13 | 0 | 0 | 9.345 | 42 U.S.C. § 12102 |
| G077 | 1.000 | 14 | 14 | 0 | 0 | 3.76 | — |
| G078 | 0.000 | 14 | 14 | 0 | 0 | 3.867 | 42 U.S.C. § 12111 |
| G079 | 1.000 | 14 | 14 | 0 | 0 | 4.709 | — |
| G080 | 1.000 | 13 | 13 | 0 | 0 | 5.071 | — |
| G081 | 0.000 | 14 | 14 | 0 | 0 | 3.724 | 42 U.S.C. § 12112, 29 C.F.R. § 1630.2 |
| G082 | 1.000 | 14 | 14 | 0 | 0 | 3.401 | — |
| G083 | 0.500 | 14 | 14 | 0 | 0 | 3.363 | 29 C.F.R. § 1630.2 |
| G084 | 1.000 | 14 | 14 | 0 | 0 | 3.793 | — |
| G085 | 0.000 | 14 | 14 | 0 | 0 | 3.403 | 42 U.S.C. § 12111 |
| G086 | 0.000 | 14 | 14 | 0 | 0 | 4.667 | 42 U.S.C. § 12111 |
| G087 | 1.000 | 14 | 14 | 0 | 0 | 21.708 | — |
| G088 | 1.000 | 17 | 17 | 0 | 0 | 19.703 | — |
| G089 | 0.000 | 14 | 13 | 0 | 0 | 3.459 | 29 C.F.R. § 1630.2 |
| G090 | 1.000 | 14 | 14 | 0 | 0 | 9.785 | — |
| G091 | 1.000 | 14 | 14 | 0 | 0 | 14.114 | — |
| G092 | 1.000 | 14 | 14 | 0 | 0 | 22.499 | — |
| G093 | 1.000 | 14 | 13 | 0 | 0 | 13.978 | — |
| G094 | 1.000 | 14 | 14 | 0 | 0 | 12.488 | — |
| G095 | 1.000 | 14 | 13 | 0 | 0 | 8.021 | — |
| G096 | 1.000 | 14 | 14 | 0 | 0 | 5.463 | — |
| G097 | 1.000 | 14 | 13 | 0 | 0 | 12.517 | — |
| G098 | 1.000 | 14 | 14 | 0 | 0 | 4.197 | — |
| G099 | 0.000 | 14 | 14 | 0 | 0 | 7.48 | 530 U.S. 133, 309 F.3d 893 |
| G100 | 0.000 | 14 | 13 | 0 | 0 | 5.731 | 29 U.S.C. § 631 |
