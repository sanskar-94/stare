"""Query-type routing for the attorney's research question.

A question that names a case ("Burlington Northern v. White", "548 U.S. 53") or a statute section ("§ 2000e-3",
"29 C.F.R. § 1630.2") gets an exact-match lookup in addition to the hybrid search, and what it names is ranked
first; a conceptual question is answered by the hybrid search alone.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from eyecite import get_citations
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from stare.db.models import Citation, CitationEdge, Opinion, StatuteSection

_CASE_NAME = re.compile(r"\b([A-Z][\w.,&'’-]*(?:\s+(?:of|the|&|[A-Z][\w.,&'’-]*)){0,7})\s+v\.\s+"
                        r"([A-Z][\w.,&'’-]*(?:\s+(?:of|the|&|[A-Z][\w.,&'’-]*)){0,5})")  # "Burlington Industries, Inc. v. Ellerth"
_SECTION = re.compile(r"(?:§+|\bsection\s+|\bsec\.\s+)\s*(\d+[a-z]?(?:-\d+[a-z]?)?(?:\.\d+)?)", re.IGNORECASE)
_LEAD = re.compile(r"^(?:(?:See|Cf\.|Accord|But|Also|In|Under|Following|Applying|Apply|Does|Did|Do|What|How|Is|Was|Why|When|Can)\s+)+")
_SKIP = {"inc", "co", "corp", "llc", "ltd", "the", "of", "and", "&", "company", "corporation", "united", "states"}


@dataclass
class Route:
    kind: str = "conceptual"  # conceptual | case | statute | mixed
    cites: list[tuple[str, str, str]] = field(default_factory=list)  # (volume, reporter, page)
    case_names: list[tuple[str, str]] = field(default_factory=list)
    sections: list[str] = field(default_factory=list)


def classify(text: str) -> Route:
    r = Route()
    for c in get_citations(text or ""):
        g = getattr(c, "groups", None) or {}
        if g.get("volume") and g.get("reporter") and g.get("page"):
            r.cites.append((g["volume"], c.corrected_reporter(), g["page"]))
    r.case_names = [(_LEAD.sub("", a.strip(" ,")) or a.strip(" ,"), b.strip(" ,"))
                    for a, b in _CASE_NAME.findall(text or "")]
    r.sections = list(dict.fromkeys(_SECTION.findall(text or "")))
    case = bool(r.cites or r.case_names)
    r.kind = "mixed" if case and r.sections else "case" if case else "statute" if r.sections else "conceptual"
    return r


def _key_word(party: str) -> str | None:
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z'-]+", party) if w.lower() not in _SKIP and len(w) > 2]
    return words[0] if words else None


def resolve(session: Session, route: Route) -> tuple[list[int], list[int]]:
    """(opinion ids, statute section ids) named by the question. Among several opinions matching a case name,
    the most-cited one is taken (the leading case)."""
    ops: list[int] = []
    for vol, rep, page in route.cites:
        oid = session.scalar(select(Citation.opinion_id).where(Citation.volume == vol, Citation.reporter == rep,
                                                                 Citation.page == page))
        if oid:
            ops.append(oid)
    for a, b in route.case_names:
        ka, kb = _key_word(a), _key_word(b)
        if not ka:
            ka, kb = kb, None
        if not ka:
            continue
        q = select(Opinion.id).where(Opinion.case_name.ilike(f"%{ka}%"))
        if kb:
            q = q.where(Opinion.case_name.ilike(f"%{kb}%"))
        ids = list(session.scalars(q.limit(50)))
        if ids:
            counts = dict(session.execute(select(CitationEdge.cited_id, func.count()).where(CitationEdge.cited_id.in_(ids))
                                          .group_by(CitationEdge.cited_id)).all())
            ops.append(max(ids, key=lambda i: counts.get(i, 0)))
    secs = list(session.scalars(select(StatuteSection.id).where(StatuteSection.section.in_(route.sections)))) \
        if route.sections else []
    return list(dict.fromkeys(ops)), secs
