"""Named-authority benchmark for query-type routing.

40 questions name the 40 most-cited opinions in the corpus (half by case name, half by reporter citation).
For each: is the named opinion among the first 10 opinions of the hybrid search alone, and does routing
(classify + exact-match resolve) find it? Run: python -m stare.eval.routing_bench docs/evaluation/routing_named_authorities.json
"""
import json
import sys

from sqlalchemy import func, select

from stare.agents.routing import classify, resolve
from stare.db.models import Citation, CitationEdge, Opinion
from stare.db.session import get_sessionmaker
from stare.retrieval.hybrid import HybridRetriever


def main(out_path: str) -> dict:
    sf = get_sessionmaker()
    ret = HybridRetriever(sf)
    with sf() as s:
        top = s.execute(select(CitationEdge.cited_id, func.count()).group_by(CitationEdge.cited_id)
                        .order_by(func.count().desc()).limit(40)).all()
        cases = []
        for oid, _ in top:
            o = s.get(Opinion, oid)
            cite = s.execute(select(Citation.volume, Citation.reporter, Citation.page).where(Citation.opinion_id == oid)).first()
            cases.append((oid, o.case_name, cite))
    qs = []
    for i, (oid, name, cite) in enumerate(cases):
        if i % 2 == 0 or not cite:
            qs.append((oid, f"What did {name} hold, and does it help our client's discrimination claim?"))
        else:
            qs.append((oid, f"Does {cite[0]} {cite[1]} {cite[2]} help our client's discrimination claim?"))
    hyb = rout = 0
    rows = []
    for oid, q in qs:
        res = ret.search(q, k=30)
        ops = list(dict.fromkeys(c.opinion_id for c in res if c.opinion_id))[:10]
        h = oid in ops
        with sf() as s:
            r = classify(q); found, _ = resolve(s, r)
        t = oid in found
        hyb += h; rout += t
        rows.append({"q": q, "hybrid_top10": h, "routing": t, "route": r.kind})
    out = {"questions": len(qs), "hybrid_top10": hyb, "routing_exact": rout, "either": sum(r["hybrid_top10"] or r["routing"] for r in rows), "rows": rows}
    print(json.dumps({k: v for k, v in out.items() if k != "rows"}))
    with open(out_path, "w") as fh:
        json.dump(out, fh, indent=1)
    return out


if __name__ == "__main__":
    main(sys.argv[1])
