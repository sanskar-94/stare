"""Corpus expansion from CAP: case selection by anchor citations, and the offline import from gzip shards."""

from __future__ import annotations

import gzip
import json

from sqlalchemy import select

from stare.db.models import Citation, CitationEdge, Opinion
from stare.ingest.expand import cited_paths, import_expansion, iter_cached, read_manifest, write_manifest
from stare.ingest.pipeline import load_courts

EMPLOYMENT = ("Plaintiff sued under Title VII of the Civil Rights Act of 1964, 42 U.S.C. 2000e-2, and the Americans "
              "with Disabilities Act. We apply the McDonnell Douglas framework. ")


def test_cited_paths_counts_federal_cases_once_per_citing_case():
    a = {"id": 1, "cites_to": [{"cite": "x", "case_ids": [10], "case_paths": ["/f3d/5/0001-01"]},
                               {"cite": "x again", "case_ids": [10], "case_paths": ["/f3d/5/0001-01"]},
                               {"cite": "state", "case_ids": [11], "case_paths": ["/sw2d/9/0002-01"]}]}
    b = {"id": 2, "cites_to": [{"cite": "x", "case_ids": [10], "case_paths": ["/f3d/5/0001-01"]},
                               {"cite": "y", "case_ids": [12], "case_paths": ["/us/411/0792-01"]}]}
    counts = cited_paths([a, b])
    assert counts == {("10", "/f3d/5/0001-01"): 2, ("12", "/us/411/0792-01"): 1}


def test_manifest_round_trip_deduplicates(tmp_path):
    rows = [{"id": 2, "path": "/f3d/10/0002-01", "hop": 1}, {"id": 1, "path": "/f3d/9/0001-01", "hop": 1},
            {"id": 2, "path": "/f3d/10/0002-01", "hop": 1}]
    write_manifest(tmp_path, rows)
    assert [r["id"] for r in read_manifest(tmp_path)] == [2, 1]


def _case(i: int, court: str, text: str, cites_to: list[int] = ()) -> dict:
    return {"id": i, "name": f"Doe {i} v. Acme Corp.", "name_abbreviation": f"Doe {i} v. Acme Corp.",
            "decision_date": "2005-06-01", "docket_number": "", "citations": [{"type": "official", "cite": f"{400 + i} F.3d 10"}],
            "court": {"name_abbreviation": court, "name": ""},
            "cites_to": [{"cite": f"{400 + c} F.3d 10", "case_ids": [c]} for c in cites_to],
            "casebody": {"opinions": [{"type": "majority", "author": None, "text": text}]}}


def test_import_expansion_filters_and_links(session, tmp_path):
    load_courts(session)
    cases = [_case(901, "5th Cir.", EMPLOYMENT * 2), _case(902, "9th Cir.", EMPLOYMENT * 2 + " See 901.", [901]),
             _case(903, "5th Cir.", "A contract dispute about a shipment of grain."),
             _case(904, "Tex. App.", EMPLOYMENT * 2)]
    with gzip.open(tmp_path / "cases-001.jsonl.gz", "wt", encoding="utf-8") as fh:
        fh.writelines(json.dumps(c) + "\n" for c in cases)
    assert len(list(iter_cached(tmp_path))) == 4

    result = import_expansion(session, out_dir=tmp_path)
    assert result["opinions"] == 2 and result["skipped"] == 2 and result["edges"] == 1
    ops = {o.source_id: o for o in session.scalars(select(Opinion))}
    assert set(ops) == {"901", "902"} and ops["901"].court_id == "ca5" and ops["902"].court_id == "ca9"
    assert session.scalar(select(Citation.cite).where(Citation.opinion_id == ops["901"].id)) == "1301 F.3d 10"
    edge = session.scalars(select(CitationEdge)).one()
    assert (edge.citing_id, edge.cited_id) == (ops["902"].id, ops["901"].id)

    again = import_expansion(session, out_dir=tmp_path)  # idempotent
    assert again["edges"] == 0 and len(session.scalars(select(Opinion)).all()) == 2


def test_dc_circuit_reporter_is_not_us_reports():
    from stare.courts.hierarchy import CourtHierarchy
    from stare.ingest.cap import _court_id

    h = CourtHierarchy.default()
    dc = {"citations": [{"type": "official", "cite": "276 U.S. App. D.C. 167"}],
          "court": {"name_abbreviation": "D.C. Cir.", "name": "United States Court of Appeals for the District of Columbia Circuit"}}
    us = {"citations": [{"type": "official", "cite": "570 U.S. 338"}], "court": {"name_abbreviation": "5th Cir."}}
    assert _court_id(dc, h) == "cadc"
    assert _court_id(us, h) == "scotus"


def test_parallel_reporter_copy_is_not_imported_twice(session, tmp_path):
    load_courts(session)
    a = _case(905, "5th Cir.", EMPLOYMENT * 2)
    b = _case(906, "5th Cir.", EMPLOYMENT * 2)  # same decision, another CAP id (e.g. an L. Ed. 2d copy)
    b["citations"] = [{"type": "parallel", "cite": "1305 F.3d 10"}]
    c = _case(907, "9th Cir.", EMPLOYMENT * 2, [906])  # cites the copy's CAP id
    with gzip.open(tmp_path / "cases-001.jsonl.gz", "wt", encoding="utf-8") as fh:
        fh.writelines(json.dumps(x) + "\n" for x in (a, b, c))
    result = import_expansion(session, out_dir=tmp_path)
    assert result["opinions"] == 2 and result["duplicates"] == 1 and result["edges"] == 1
    ops = {o.source_id: o for o in session.scalars(select(Opinion))}
    edge = session.scalars(select(CitationEdge)).one()
    assert set(ops) == {"905", "907"} and edge.cited_id == ops["905"].id
