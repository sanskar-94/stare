"""FastAPI application factory. `uvicorn stare.api.main:app` builds the app lazily on first access."""

from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session, sessionmaker

from stare import __version__
from stare.api.deps import ensure_state, service_for
from stare.api.routers import admin, auth_routes, documents, matters, misc, runs, users
from stare.config import get_settings
from stare.graph.service import ExportBlockedError, MemoVerificationError, ResearchService, RunStateError


def _json(status: int, message: str, **extra) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": message, **extra})


def create_app(service: ResearchService | None = None, session_factory: sessionmaker[Session] | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        ensure_state(app)  # init_db
        if service is None and app.state.settings.warm_up:
            # load the index and the embedding model now, so the first research run starts at full speed
            app.state.search_ready = False
            threading.Thread(target=_warm_up, args=(app,), name="stare-warm-up", daemon=True).start()
        yield
        svc = app.state.service
        if svc is not None and svc is not service:
            svc.pool.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="STARE API", version=__version__, lifespan=lifespan)
    app.state.service = service
    app.state.session_factory = session_factory
    app.state.ready = False

    origins = (service.settings if service else get_settings()).cors_origins
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(LookupError)
    async def _lookup(_: Request, exc: LookupError):
        return _json(404, str(exc.args[0]) if exc.args else "Not found")

    @app.exception_handler(ExportBlockedError)
    async def _blocked(_: Request, exc: ExportBlockedError):
        return _json(409, str(exc), problems=exc.problems)

    @app.exception_handler(RunStateError)
    async def _state(_: Request, exc: RunStateError):
        return _json(409, str(exc))

    @app.exception_handler(MemoVerificationError)
    async def _memo(_: Request, exc: MemoVerificationError):
        return _json(422, str(exc), problems=exc.problems)

    @app.exception_handler(PermissionError)
    async def _perm(_: Request, exc: PermissionError):
        return _json(403, str(exc) or "Forbidden")

    from stare.retrieval.hybrid import IndexNotBuiltError, IndexStaleError

    @app.exception_handler(IndexNotBuiltError)
    @app.exception_handler(IndexStaleError)
    async def _index(_: Request, exc: Exception):
        return _json(503, f"{exc} The legal corpus index is unavailable; ask an administrator to ingest the corpus "
                          "and run `stare index build`.")

    for module in (auth_routes, users, misc, matters, documents, runs, admin):
        app.include_router(module.router, prefix="/api")
    _serve_frontend(app, (service.settings if service else get_settings()).frontend_dist)
    return app


def _warm_up(app: FastAPI) -> None:
    took = service_for(app).warm_up()
    app.state.search_ready = True
    logging.getLogger("uvicorn.error").info("Search index and embedding model ready (%.1f s)", took)


def _serve_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built React app (frontend/dist) at /, with client-side routes falling back to index.html.

    `stare serve` then runs the whole system on one port; `npm run dev` still works for development.
    """
    index = dist / "index.html"
    if not index.is_file():
        return
    root = dist.resolve()

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def _spa(path: str):
        if path == "api" or path.startswith("api/"):
            return _json(404, "Not found")
        f = (root / path).resolve()
        if path and f.is_file() and root in f.parents:
            return FileResponse(f)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


_app: FastAPI | None = None


def __getattr__(name: str):  # lazy module-level `app` so importing this module has no side effects
    global _app
    if name == "app":
        if _app is None:
            _app = create_app()
        return _app
    raise AttributeError(name)
