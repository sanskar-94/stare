# STARE: short guide

A one-page overview: what STARE is, how to run it, and how to demo it. For full detail, see [README.md](README.md).

## What it is

STARE is a research assistant for US employment-discrimination law (Title VII, ADA, ADEA). You upload a
complaint and approve a research plan. The agents then find and rank case law and look for authority that
hurts the client. The **Citation Firewall** checks every citation against real court records, and STARE
drafts an IRAC memo. Nothing can be exported until an attorney approves the memo. Fake citations, like the
six in *Mata v. Avianca*, are blocked.

Its case law is 5,120 real federal employment-discrimination opinions (328 Supreme Court, 4,313 courts of
appeals, 479 district courts) plus the Title VII, ADA and ADEA statutes and regulations. By default STARE runs fully offline and free on a laptop. It uses SQLite and a rule-based "offline" model,
so no API key is needed.

## What's in the repo

| Folder | Contents |
|---|---|
| `backend/` | Python API (FastAPI + LangGraph), agents, Citation Firewall, `stare` command-line tool, tests |
| `frontend/` | React web app (Vite) |
| `data/` | Case law (`seed/` + `expansion/`), statutes, and sample complaints in `data/samples/` (all fictional) |
| `docs/` | Design, traceability, evaluation results |
| `reports/` | Milestone reports and presentations, demo video, validation kit |

## Setup (once)

You need Python 3.12 with [`uv`](https://docs.astral.sh/uv/), Node 20+, and Tesseract (`brew install tesseract`).

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e '.[presidio,llm,dev]'
.venv/bin/python -m spacy download en_core_web_sm
.venv/bin/stare ingest all --offline    # build the case-law corpus (no internet needed, ~5 min)
.venv/bin/stare index build             # build the search index (~2 min)
.venv/bin/stare db seed-users           # create the demo accounts
```

```bash
cd frontend
npm install
```

## Run it (every time)

You need two terminals.

```bash
cd backend && .venv/bin/stare serve      # API on http://127.0.0.1:8000
```

```bash
cd frontend && npm run dev               # app on http://localhost:5173
```

Open http://localhost:5173 and sign in. The password for every account is `stare-demo`.

| Account | Role |
|---|---|
| `attorney@stare.local` | Approves plans and memos, exports |
| `paralegal@stare.local` | Creates matters and uploads documents; cannot export |
| `admin@stare.local` | Sees the audit log |

## Demo walkthrough (about 3 minutes)

1. Sign in as the attorney and click **+ New matter**. Search the court list for "N.D. Tex", pick it, and create the matter.
2. Upload `data/samples/complaint_ndtex_title7_retaliation.pdf`. Names and personal details are redacted automatically.
3. Click **Start research run**. The run stops at the research plan. Review the plan, then click **Approve plan**.
4. The agents run, and the live trace shows each step. When they finish, look at the **Precedent graph** and the **Adverse** tab.
5. Open the **Memo** tab, click **Approve memo**, then **Export DOCX**.
6. Go to **Check a draft** and click **Load the Mata v. Avianca example**, then **Check citations**. The six fake cases are flagged.

To run the whole pipeline in the terminal instead, without the web app:

```bash
cd backend && .venv/bin/stare demo
```

A recorded backup of this walkthrough is in `reports/STARE MVP demo (captioned).webm`.

## Tests and evaluation

```bash
cd backend && .venv/bin/pytest          # all backend tests, offline
cd frontend && npm run build            # type check + production build
cd backend && .venv/bin/stare eval mata # Mata v. Avianca check only
cd backend && .venv/bin/stare eval run  # full evaluation -> docs/evaluation/results.md
```

GitHub Actions runs the tests and the build on every push.

## Optional settings

Put settings in `backend/.env.local`. Copy `backend/.env.example` to create it; the file stays out of git.

- `STARE_COURTLISTENER_TOKEN=...`: a free token from courtlistener.com. With it, citations that aren't in the
  local corpus are checked online, so all six Mata citations show as "blocked" instead of "unresolved".
- `STARE_LLM_PROVIDER=openai_compat` with `STARE_LLM_BASE_URL` and `STARE_LLM_MODEL`: use a real language model
  (for example a free local Ollama model) instead of offline mode.
- `STARE_DATABASE_URL=postgresql+psycopg://...`: use PostgreSQL + pgvector (`docker compose up db`) instead of SQLite.

## If something goes wrong

| Problem | Fix |
|---|---|
| `stare: command not found` | Run it as `.venv/bin/stare` from inside `backend/` |
| Login fails | Run `.venv/bin/stare db seed-users` again |
| Search returns nothing | Run `stare ingest all --offline`, then `stare index build` |
| Frontend shows network errors | Check that `stare serve` is running on port 8000 |
| Port already in use | `lsof -ti :8000 \| xargs kill` (or `:5173`) |
| Want a clean database | Delete `data/stare.db` and `data/checkpoints.sqlite`, then repeat the setup steps from `ingest` onwards |
