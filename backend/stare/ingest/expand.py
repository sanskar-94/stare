"""Corpus expansion from the Caselaw Access Project (static.case.law) by citation snowballing.

The seed corpus (data/seed) is a hand-picked set of leading cases. The expansion follows their citations: every
federal case the seed opinions cite (hop 1), then every federal case cited by at least `min_cited_by` of the
employment opinions found so far (hop 2, and so on). CAP's `cites_to` field gives the exact path of each cited
case, so no search is needed. A fetched case is kept only if it is from a federal court in STARE's hierarchy and
its full text is an employment-discrimination opinion (`is_employment_text`); the rest are recorded as checked
and dropped.

Outputs, both committed so that a fresh clone builds offline and the corpus can be reproduced exactly:

* data/expansion/manifest.jsonl: every case checked (id, path, name, cite, court, date, hop, kept);
* data/expansion/cases-NNN.jsonl.gz: the slimmed CAP JSON of every kept case.

No case text is written or changed by hand; every row comes from the CAP JSON.
"""

from __future__ import annotations

import gzip
import json
from collections import Counter
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from stare.config import REPO_DIR
from stare.courts.hierarchy import CourtHierarchy
from stare.db.models import Citation, CitationEdge, CourtRow, Opinion
from stare.ingest.cap import (
    CAP_BASE,
    USER_AGENT,
    _cite_context,
    _court_id,
    case_text,
    import_cap_case,
    parse_cite,
    slim_cap_case,
)
from stare.ingest.relevance import is_employment_text

EXPANSION_DIR = REPO_DIR / "data" / "expansion"
MANIFEST = "manifest.jsonl"
SHARD_SIZE = 250

# CAP reporter slugs that only publish federal decisions.
FEDERAL_REPORTERS = {"us", "s-ct", "l-ed", "l-ed-2d", "f", "f2d", "f3d", "f-supp", "f-supp-2d", "f-supp-3d",
                     "f-appx", "frd", "us-app-dc"}

Say = Callable[[str], None]


def _quiet(_: str) -> None:
    pass


# ---------------------------------------------------------------------------------------------- cache files
def read_manifest(d: Path | None = None) -> list[dict]:
    f = (d or EXPANSION_DIR) / MANIFEST
    if not f.exists():
        return []
    return [json.loads(line) for line in f.read_text().splitlines() if line.strip()]


def write_manifest(d: Path, rows: Iterable[dict]) -> None:
    d.mkdir(parents=True, exist_ok=True)
    uniq = {str(r["id"]): r for r in rows}
    ordered = sorted(uniq.values(), key=lambda r: (r.get("hop", 0), r.get("path", "")))
    (d / MANIFEST).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in ordered))


def iter_cached(d: Path | None = None) -> Iterator[dict]:
    for shard in sorted((d or EXPANSION_DIR).glob("cases-*.jsonl.gz")):
        with gzip.open(shard, "rt", encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    yield json.loads(line)


def _write_shard(d: Path, cases: list[dict]) -> None:
    if not cases:
        return
    n = len(list(d.glob("cases-*.jsonl.gz"))) + 1
    with gzip.open(d / f"cases-{n:03d}.jsonl.gz", "wt", encoding="utf-8") as fh:
        for c in cases:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------------------------- selection
def cited_paths(cases: Iterable[dict]) -> Counter:
    """(case id, CAP path) of every federal case cited by `cases`, counted once per citing case."""
    counts: Counter = Counter()
    for case in cases:
        mine: dict[str, str] = {}
        for c in case.get("cites_to") or []:
            for path, cid in zip(c.get("case_paths") or [], c.get("case_ids") or [], strict=False):
                slug = path.strip("/").split("/")[0]
                if slug in FEDERAL_REPORTERS and str(cid) not in mine:
                    mine[str(cid)] = path
        counts.update(mine.items())
    return counts


def keep_case(case: dict, hierarchy: CourtHierarchy, known_courts: set[str]) -> str | None:
    """The court id when the case is a federal employment-discrimination opinion STARE can rank, else None."""
    if not (case.get("casebody") or {}).get("opinions"):
        return None
    cid = _court_id(case, hierarchy)
    if cid is None or cid not in known_courts:
        return None
    return cid if is_employment_text(case_text(case)) else None


def _seed_cases() -> list[dict]:
    from stare.ingest.seed import SEED_DIR, load_manifest, raw_name

    out = []
    for e in load_manifest()["cases"]:
        f = SEED_DIR / "raw" / raw_name(e)
        if f.exists() and (e.get("source") or "cap") == "cap":
            out.append(json.loads(f.read_text()))
    return out


# ---------------------------------------------------------------------------------------------- snowball
def snowball(*, hops: int = 2, min_cited_by: tuple[int, ...] = (1, 2), max_new: int | None = None,
             workers: int = 96, out_dir: Path | None = None, say: Say = _quiet) -> dict[str, int]:
    """Follow citations out from the seed, `hops` steps. Resumable: cases already in the manifest are not
    fetched again. Hop h keeps candidates cited by at least min_cited_by[h-1] kept cases."""
    from stare.courts.hierarchy import CourtHierarchy

    d = out_dir or EXPANSION_DIR
    d.mkdir(parents=True, exist_ok=True)
    h = CourtHierarchy.default()
    known = {c.id for c in h.all()}
    rows = {str(r["id"]): r for r in read_manifest(d)}
    kept_cases = list(iter_cached(d))
    seed = _seed_cases()
    done_ids = set(rows) | {str(c["id"]) for c in seed}

    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=httpx.Timeout(120, connect=30),
                      follow_redirects=True, limits=httpx.Limits(max_connections=workers)) as client:

        def get(path: str) -> dict | None:
            url = f"{CAP_BASE}/{path.strip('/').rsplit('/', 1)[0]}/cases/{path.rsplit('/', 1)[1]}.json"
            for _ in range(3):
                try:
                    r = client.get(url)
                    if r.status_code == 404:
                        return None
                    r.raise_for_status()
                    return r.json()
                except (httpx.HTTPError, json.JSONDecodeError):
                    continue
            return None

        for hop in range(1, hops + 1):
            need = min_cited_by[min(hop, len(min_cited_by)) - 1]
            sources = seed + [c for c in kept_cases if rows.get(str(c["id"]), {}).get("hop", 0) < hop]
            counts = cited_paths(sources)
            todo = [(cid, path) for (cid, path), n in counts.most_common() if n >= need and cid not in done_ids]
            if max_new is not None:
                todo = todo[:max_new]
            say(f"hop {hop}: {len(todo)} cases to check (cited by >= {need} kept opinions)")
            buf: list[dict] = []
            kept_now = 0
            with ThreadPoolExecutor(workers) as pool:
                futures = {pool.submit(get, path): (cid, path) for cid, path in todo}
                for i, fut in enumerate(as_completed(futures), 1):
                    cid, path = futures[fut]
                    raw = fut.result()
                    done_ids.add(cid)
                    if raw is None:
                        rows[cid] = {"id": int(cid), "path": path, "hop": hop, "kept": False, "error": "fetch"}
                        continue
                    case = slim_cap_case(raw)
                    court = keep_case(case, h, known)
                    rows[cid] = {"id": case["id"], "path": path, "hop": hop, "kept": court is not None,
                                 "name": case.get("name_abbreviation", ""), "court": court or "",
                                 "cite": next((c["cite"] for c in case.get("citations", [])
                                               if c.get("type") == "official"), ""),
                                 "date": case.get("decision_date")}
                    if court:
                        buf.append(case)
                        kept_cases.append(case)
                        kept_now += 1
                    if len(buf) >= SHARD_SIZE:
                        _write_shard(d, buf)
                        buf = []
                        write_manifest(d, rows.values())
                    if i % 200 == 0 or i == len(todo):
                        write_manifest(d, rows.values())
                        say(f"  hop {hop}: checked {i}/{len(todo)}, kept {kept_now}")
            _write_shard(d, buf)
            write_manifest(d, rows.values())
    return {"checked": len(rows), "kept": sum(1 for r in rows.values() if r.get("kept"))}


# ---------------------------------------------------------------------------------------------- import
def import_expansion(session: Session, *, out_dir: Path | None = None, say: Say = _quiet,
                     batch: int = 300) -> dict[str, int]:
    """Import every cached expansion case (federal court known to STARE, employment text) and link citation
    edges among all CAP opinions, seed included."""
    h = CourtHierarchy.default()
    known_courts = set(session.scalars(select(CourtRow.id)))
    # CAP holds some decisions twice (e.g. U.S. Reports and L. Ed. 2d) under different ids: a case whose
    # citation is already in the index is the same decision, so it is not imported again and citations of
    # its CAP id are linked to the opinion already stored.
    cite_owner = {(c.volume, c.reporter, c.page): c.opinion_id for c in session.scalars(select(Citation))}
    alias: dict[str, int] = {}
    added = skipped = dupes = 0
    cases: list[dict] = []
    for case in iter_cached(out_dir):
        if keep_case(case, h, known_courts) is None:
            skipped += 1
            continue
        parsed = [p for c in case.get("citations", []) if c.get("type") != "vendor" and (p := parse_cite(c["cite"]))]
        owner = next((cite_owner[p] for p in parsed if p in cite_owner), None)
        existing = session.scalar(select(Opinion.id).where(Opinion.source == "cap", Opinion.source_id == str(case["id"])))
        if owner is not None and owner != existing:
            alias[str(case["id"])] = owner
            dupes += 1
            continue
        op = import_cap_case(session, case, hierarchy=h)
        for p in parsed:
            cite_owner.setdefault(p, op.id)
        cases.append(case)
        added += 1
        if added % batch == 0:
            session.commit()
            say(f"  imported {added}")
    session.commit()

    # Edges among every CAP opinion in the database (seed cases now gain edges to and from the expansion).
    by_cap_id = dict(session.execute(select(Opinion.source_id, Opinion.id).where(Opinion.source == "cap")).all())
    by_cap_id.update(alias)
    existing = set(session.execute(select(CitationEdge.citing_id, CitationEdge.cited_id)).all())
    edges = 0
    for case in _seed_cases() + cases:
        citing = by_cap_id.get(str(case["id"]))
        if citing is None:
            continue
        text = None
        for c in case.get("cites_to", []):
            for cid in c.get("case_ids") or []:
                cited = by_cap_id.get(str(cid))
                if cited is None or cited == citing or (citing, cited) in existing:
                    continue
                text = text if text is not None else case_text(case)
                session.add(CitationEdge(citing_id=citing, cited_id=cited, context=_cite_context(text, c["cite"])))
                existing.add((citing, cited))
                edges += 1
    session.commit()
    return {"opinions": added, "duplicates": dupes, "skipped": skipped, "edges": edges}
