# Expanded case-law corpus

The seed corpus (`../seed`) is a hand-picked set of 151 leading opinions. This folder grows it into a corpus of
**5,120 federal employment-discrimination opinions** (seed included) by following citations, the way a lawyer
does: start from the leading cases and read the cases they rely on.

Built with `stare ingest expand` (code: `backend/stare/ingest/expand.py`) on 18 November 2026 from the Caselaw
Access Project (static.case.law):

1. **Hop 1.** Every federal case cited by a seed opinion: 4,262 cases checked, 1,703 kept.
2. **Hop 2.** Every federal case cited by at least two of the opinions kept so far: 9,572 checked, 3,447 kept.

A case is kept only if it is from a federal court in STARE's court table and its text is an
employment-discrimination opinion (at least two references to Title VII, the ADA, the ADEA or their US Code
sections; `stare/ingest/relevance.py`). Of the 5,150 kept cases, 181 are a second copy of a decision CAP holds in
two reporters (for example U.S. Reports and L. Ed. 2d); the importer recognises them by citation and links their
citations to the copy already stored, so 4,969 new opinions are imported.

| | Count |
|---|---|
| Opinions in the database (seed + expansion) | 5,120 |
| Supreme Court | 328 |
| Courts of appeals | 4,313 (Fifth Circuit 843, Ninth Circuit 487, every other circuit 175 to 566) |
| District courts | 479 |
| Years | 1964 to 2024 |
| Citation-index entries (official and parallel cites) | 5,831 |
| Citation edges (which opinion cites which) | 68,071 |
| Search chunks (opinions, statutes and regulations) | 103,977 |

## Files

* `manifest.jsonl`: every case checked (13,834), with its CAP path, hop, court and whether it was kept.
* `cases-NNN.jsonl.gz`: the slimmed CAP JSON (name, date, citations, court, `cites_to`, opinion text) of every kept
  case, so a fresh clone builds offline: `stare ingest all --offline` imports them after the seed.

No case text was written or changed by hand. CAP's coverage ends in 2019 to 2020 for most reporters, so the
latest decisions (for example Muldrow, 2024) come from the seed, which takes them from law.cornell.edu.

## Rebuilding or extending

```bash
cd backend
.venv/bin/stare ingest expand              # fetch anything new (resumable), import, rebuild chunks
.venv/bin/stare ingest expand --no-online  # import the committed cache only
.venv/bin/stare index build
```

`--hops 3` follows one more step; `--min-cited-by` sets how many kept opinions must cite a case before it is
followed.
