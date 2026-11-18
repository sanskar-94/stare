"""Confidence score for a finished memo (shown to the attorney and in the DOCX).

Four signals, each between 0 and 1, combined with fixed weights:

* verification (35%): share of the memo's citations that the memo Firewall pass fully verified (no warning);
* authority (25%): share of the supporting case authorities that are binding in the court of filing;
* coverage (25%): share of the approved plan items backed by at least one verified case authority;
* retrieval (15%): mean retrieval relevance of the supporting authorities.

Levels: High at 0.80 or more, Medium at 0.60, Low at 0.40, otherwise Very low. The score says how well the memo
is supported by checked authority; it is not a prediction of how the court will rule.
"""

from __future__ import annotations

from stare.schemas import Authority, CitationCheck, Confidence, ResearchPlan

WEIGHTS = {"verification": 0.35, "authority": 0.25, "coverage": 0.25, "retrieval": 0.15}


def level(score: float) -> str:
    return "High" if score >= 0.8 else "Medium" if score >= 0.6 else "Low" if score >= 0.4 else "Very low"


def memo_confidence(checks: list[CitationCheck], support: list[Authority], plan: ResearchPlan | None) -> Confidence:
    cases = [a for a in support if a.kind == "case"]
    verified = sum(c.status == "verified" for c in checks)
    parts = {
        "verification": verified / len(checks) if checks else 0.0,
        "authority": sum(1 for a in cases if a.rank and a.rank.status == "binding") / len(cases) if cases else 0.0,
        "coverage": 0.0,
        "retrieval": sum(a.relevance for a in support) / len(support) if support else 0.0,
    }
    items = [i for i in (plan.items if plan else []) if i.checked]
    if items:
        backed = {a.plan_item_id for a in cases}
        parts["coverage"] = sum(1 for i in items if i.id in backed) / len(items)
    score = sum(WEIGHTS[k] * v for k, v in parts.items())
    reasons = []
    if parts["verification"] < 1:
        reasons.append(f"{len(checks) - verified} of {len(checks)} citations carry a warning")
    if parts["coverage"] < 1 and items:
        reasons.append("some plan issues have no verified case authority")
    if parts["authority"] < 0.5 and cases:
        reasons.append("most supporting cases are persuasive, not binding")
    return Confidence(score=round(score, 3), level=level(score), components={k: round(v, 3) for k, v in parts.items()},
                      notes=reasons)
