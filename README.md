# STARE: verified US employment-law research

STARE (named after *stare decisis*) is a multi-agent AI research assistant for US federal
employment-discrimination law: Title VII, the ADA and the ADEA. A paralegal uploads a complaint. An
attorney approves a research plan. Specialist agents then find, rank and challenge authority, and a
**Citation Firewall** checks every citation against real court records before the attorney sees the
IRAC memo. Nothing is exported without attorney approval.

Capstone project, Group 36, School of Computer Science Engineering and Technology, Bennett University:
Sanskar Awasthi, Rishant Ranjan, Adarsh Singh and Rahul Yadav. Supervisor: Dr. Pawan Kumar.

> Research material for licensed attorneys. Not legal advice.

**New here?** Start with [GUIDE.md](GUIDE.md): a one-page guide to setting up, running and demoing STARE.

## What it does

```
complaint PDF ─▶ Intake (PyMuPDF + Tesseract OCR, PII redaction) ─▶ case record + research plan
                                                  │
                                    ■ attorney approves the plan (hard gate)
                                                  ▼
 Research (BM25 + dense, RRF, rerank; binding-court pass; co-citation) ─▶ Precedent (binding / persuasive)
   ─▶ Opposing Counsel (adverse authority, timeliness defences)
   ─▶ Citation Firewall: Gate 1 extract · Gate 2 exists (+ case-name match) · Gate 3 quote match · Gate 4 good law
   ─▶ (too few verified? search again, max 3 loops)
   ─▶ Memo (IRAC from verified authority only) ─▶ Firewall again on the memo text
                                                  │
                                    ■ attorney approves the memo (hard gate)
                                                  ▼
                              DOCX export (refused if any citation is not verified)
```

* **Citation Firewall.** Verification is deterministic and never asks the LLM whether its own sources
  are good. All six fabricated citations from *Mata v. Avianca* are blocked (`stare eval mata`).
* **Authority ranking.** Each authority is ranked by the court hierarchy (Table 26), not only by
  similarity. A Fifth Circuit case binds N.D. Tex.; a Ninth Circuit case does not. The Research Agent also
  searches the binding courts on their own and follows the citation network: an opinion that most of the
  retrieved authorities cite is promoted as a leading case.
* **Opposing Counsel agent.** It searches only for authority that hurts the client, and it applies
  deterministic EEOC-charge timeliness checks to the extracted dates.
* **Opinion parts.** Dissents, concurrences and the Reporter's syllabus are tracked separately. STARE
  never quotes them as the court's holding, and Gate 3 warns when a quotation appears only in a dissent.
* **Human in the loop.** LangGraph interrupts at the plan gate and the memo gate. The workspace shows a
  live agent trace, and an audit log records every run, approval and export.
* **STARE-Gen, a model trained in this project.** SmolLM2-135M fine-tuned on 3,838 rule sentences that courts
  wrote when citing earlier cases (mined from the corpus's own citation network). It can add a labelled one-sentence
  summary before each verified quotation; it is off by default and every sentence must pass a grounding check
  ([data/gen/README.md](data/gen/README.md)).
* **Confidence score.** Every memo is scored on verification, binding authority, coverage of the plan and
  retrieval relevance (High / Medium / Low / Very low), in the app and in the Word export.
* **Query-type routing.** A question that names a case, a reporter citation or a statute section gets an
  exact-match lookup, and what it names is ranked first (on 40 questions naming leading cases: found 40 times,
  against 5 for text search alone).
* **Privacy.** Personal details are redacted (Presidio + regex) before any agent runs. Only redacted
  text is stored. A guard refuses to send any prompt that still contains an SSN, email or phone number.

## Zero-cost, laptop-friendly defaults

STARE runs fully offline at $0 on an 8 GB laptop. The defaults are:

* a deterministic LLM mode
* SQLite
* bge-small embeddings (on the Apple GPU or CUDA via sentence-transformers; LSA as the fallback)
* a lexical reranker
* a corpus of 5,120 real federal employment-discrimination opinions (151 hand-picked leading cases plus
  4,969 found by following their citations), cached in the repository so it builds offline

Each heavier option from the proposal (Claude or a local model, PostgreSQL + pgvector, neural
embeddings, a cross-encoder, bulk CourtListener import) is one setting away. See
[DECISIONS.md](DECISIONS.md).

## Quick start

Requirements: Python 3.12 (`uv` recommended), Node 20+, Tesseract (`brew install tesseract`).

```bash
# backend
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e '.[presidio,llm,dev,neural]'   # neural: bge-small embeddings; llm: provider SDKs for the LLM-mode tests
# optional, to train or use STARE-Gen: add the 'gen' extra (PyTorch + Transformers)
.venv/bin/python -m spacy download en_core_web_sm

.venv/bin/stare ingest all --offline   # courts, 5,120 opinions, statutes, chunks (from data/seed + data/expansion, no network)
.venv/bin/stare index build            # BM25 + bge-small dense index (≈35 min on an M1 GPU for 104k chunks; STARE_EMBEDDER=lsa: ≈2 min)
.venv/bin/stare db seed-users          # attorney@ / paralegal@ / admin@stare.local, password: stare-demo

# web app: build it once
cd ../frontend && npm install && npm run build

# run everything with one command, then open http://127.0.0.1:8000
cd ../backend && .venv/bin/stare serve # web app + API on one port (OpenAPI docs at /docs)
```

`stare serve` serves the built web app and the API together, loads the search index and the embedding model in
the background (about 15 seconds; the header shows "Loading search..." until then), and the interface shows a clear
banner if the server stops. For frontend development, `npm run dev` in `frontend/` gives hot reload on
http://localhost:5173 and proxies `/api` to port 8000.

Run the whole pipeline in the terminal, with both gates auto-approved, and save the memo as DOCX:

```bash
cd backend && .venv/bin/stare demo     # uses data/samples/complaint_ndtex_title7_retaliation.pdf
```

Sample complaints are in `data/samples/`. They include a scanned, image-only PDF that exercises OCR.
All parties and personal details in them are fictional.

## Command line

| Command | What it does |
|---|---|
| `stare ingest all [--offline]` | Build the corpus: courts, seed opinions (CAP/CourtListener), the citation-expanded opinions, statutes and regulations, chunks |
| `stare ingest expand [--no-online]` | Grow the corpus by following citations out from the seed (CAP), then import it ([data/expansion](data/expansion/README.md)) |
| `stare ingest cap-bulk PATH` / `courtlistener-bulk DIR` | Import downloaded bulk data (heavy path) |
| `stare ingest refresh [--bulk-dir DIR]` | Monthly refresh: newer bulk data, new seed cases, fresh statute text, chunks and index (cron: `0 3 1 * *`) |
| `stare index build` / `stare index search "query"` | Build or query the hybrid retrieval index |
| `stare db init` / `db seed-users` / `db create-user EMAIL` | Database setup and users |
| `stare demo [PDF]` | End-to-end run in the terminal |
| `stare serve` | Web app and API on http://127.0.0.1:8000 (build the web app once with `npm run build`) |
| `stare eval run [--limit N]` | Gold set + Mata + export check + redaction + latency → `docs/evaluation/results.md` |
| `stare eval mata` | Mata v. Avianca fixture only |
| `stare gen data` / `gen train` / `gen eval` | Build the STARE-Gen training pairs, fine-tune the model (about 45 min on an 8 GB M2), compare it with the base model |
| `stare eval baseline --answers FILE` | Score a general-purpose LLM's answers (JSONL `{id, answer}`) with the Firewall; without `--answers` it calls `STARE_LLM_PROVIDER` (costs API credits) |

## Tests

```bash
cd backend && .venv/bin/pytest            # offline; tests marked `network` are skipped unless STARE_NETWORK_TESTS=1
cd frontend && npm run build              # type check + production build
```

Every agent and every Firewall gate has its own module and unit tests (NFR-08). The Mata fixture,
the approval gates and the export check are covered by automated tests.

GitHub Actions runs both on every push (`.github/workflows/ci.yml`). The **Evaluate** workflow
(`.github/workflows/evaluate.yml`, started from the Actions tab) runs the full evaluation in the cloud on
PostgreSQL 16 + pgvector and with the fastembed (bge-small) embedder, and attaches the results to the run.

## Configuration

All settings are environment variables with the `STARE_` prefix (see `backend/stare/config.py`), or
can go in `backend/.env`. Private keys go in `backend/.env.local`, which is git-ignored and overrides
`backend/.env` (see `backend/.env.example`). Tests never read those keys.

| Variable | Default | Notes |
|---|---|---|
| `STARE_LLM_PROVIDER` | `offline` | `anthropic` (Claude) or `openai_compat` (e.g. a free local Ollama server). Hosted providers cost money. |
| `STARE_LLM_MODEL` / `STARE_LLM_FAST_MODEL` | `claude-opus-5-5` / `claude-haiku-5-5` | main drafting model / routine-step model |
| `STARE_LLM_BASE_URL` | | e.g. `http://localhost:11434/v1` for Ollama |
| `STARE_DATABASE_URL` | SQLite in `data/` | `postgresql+psycopg://…` for PostgreSQL + pgvector (`docker compose up db`) |
| `STARE_EMBEDDER` | `sentence_transformers` (bge-small, 384 dims, Apple GPU/CUDA when present) | `fastembed` (same model, ONNX on the CPU), `lsa` (used automatically when the `neural` extra is not installed) |
| `STARE_MEMO_WRITER` | `extractive` | `stare_gen` adds STARE-Gen's labelled rule summaries (needs `models/stare-gen`, see `stare gen train`) |
| `STARE_RERANKER` | `lexical` | `cross_encoder` |
| `STARE_COURTLISTENER_TOKEN` | | free CourtListener token; enables the citation-lookup API fallback |
| `STARE_JWT_SECRET` | dev value | **set in any shared deployment** |

## Repository layout

```
backend/stare/
  agents/        Intake, Research, Precedent, Opposing Counsel, Firewall, Memo (+ memo Firewall pass)
  graph/         LangGraph orchestrator (approval interrupts), ResearchService, event bus
  citations/     Citation Firewall: parser (Gate 1), index, CourtListener client, gates 2-4, quote matching
  retrieval/     tokenizer, BM25, LSA/neural embedders, RRF, rerankers, HybridRetriever
  courts/        federal court hierarchy and AuthorityRanker (Table 26)
  intake/        PDF/OCR reader, PII redactor, case-record extractor, legal elements, planner
  ingest/        CAP / CourtListener (bulk + seed), US Code / eCFR, chunker
  export/        DOCX memo exporter
  api/           FastAPI app, JWT auth and roles, routers, SSE live trace
  eval/          evaluation harness and LLM baseline
frontend/src/    React research workspace (trace, sources, plan, memo editor, precedent graph, draft checker)
data/            seed and expanded corpus caches, statutes cache, court registry, samples, gold set, Mata fixture
docs/            contracts, design document, traceability, evaluation results
```

## Documentation

* [docs/DESIGN.md](docs/DESIGN.md): the design document (architecture, data model, workflow, API)
* [docs/CONTRACTS.md](docs/CONTRACTS.md): module interfaces and the HTTP API
* [docs/TRACEABILITY.md](docs/TRACEABILITY.md): proposal requirements mapped to code and tests
* [docs/evaluation/results.md](docs/evaluation/results.md): evaluation results (Table 29 metrics) on the 5,120-opinion corpus with bge-small
  (recall@10 0.79, all citation guarantees met); the same run with LSA is in `results_expanded_lsa.md`, the
  151-opinion seed run in `results_seed_corpus.md`, the named-authority routing check in `routing_named_authorities.json`
* [docs/evaluation/support_review.md](docs/evaluation/support_review.md): review of whether cited authorities support their propositions (criteria 3–4)
* [DECISIONS.md](DECISIONS.md): implementation decisions and how to switch to the heavier options

## Data sources and attribution

Case law comes from the [Caselaw Access Project](https://case.law/) (Harvard Law School Library Innovation
Lab) and [CourtListener](https://www.courtlistener.com/) (Free Law Project). Statutes come from the
[Legal Information Institute](https://www.law.cornell.edu/uscode/text) and regulations from the
[eCFR](https://www.ecfr.gov/). All are public legal data, used under the providers' terms. See
`data/seed/README.md`, `data/expansion/README.md` and `data/statutes/README.md`.
