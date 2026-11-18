"""Query-type routing, the memo confidence score and STARE-Gen's grounding check and data extraction."""

from __future__ import annotations

from stare.agents.routing import classify
from stare.confidence import level, memo_confidence
from stare.gen.data import best_passage, proposition
from stare.gen.prompt import acceptable, support
from stare.gen.writer import get_writer
from stare.schemas import Authority, AuthorityRank, PlanItem, ResearchPlan


def test_classify_case_statute_and_conceptual_questions():
    r = classify("What did Burlington Northern & Santa Fe Railway Co. v. White hold?")
    assert r.kind == "case" and r.case_names[0][0].startswith("Burlington")
    assert classify("Apply 548 U.S. 53 to these facts").cites == [("548", "U.S.", "53")]
    assert classify("Does 42 U.S.C. § 2000e-3 cover informal complaints?").sections == ["2000e-3"]
    assert classify("Is 29 C.F.R. § 1630.2 relevant, and McDonnell Douglas Corp. v. Green?").kind == "mixed"
    assert classify("What counts as a materially adverse action?").kind == "conceptual"


class _Check:
    def __init__(self, status):
        self.status = status


def _case(key, item, status, rel=0.9):
    return Authority(key=key, kind="case", citation=key, plan_item_id=item, relevance=rel,
                     rank=AuthorityRank(status=status, weight=1.0, reason=""))


def test_memo_confidence_combines_four_signals():
    plan = ResearchPlan(question="q", items=[PlanItem(id="P1", issue="a", checked=True),
                                             PlanItem(id="P2", issue="b", checked=True)])
    strong = memo_confidence([_Check("verified")] * 4, [_case("1", "P1", "binding"), _case("2", "P2", "binding")], plan)
    assert strong.level == "High" and strong.components["coverage"] == 1.0 and strong.score >= 0.95
    weak = memo_confidence([_Check("verified"), _Check("warning")], [_case("1", "P1", "persuasive", 0.5)], plan)
    assert weak.components == {"verification": 0.5, "authority": 0.0, "coverage": 0.5, "retrieval": 0.5}
    assert weak.score == 0.375 and weak.level == "Very low" and len(weak.notes) == 3
    assert [level(x) for x in (0.85, 0.65, 0.45, 0.1)] == ["High", "Medium", "Low", "Very low"]


SOURCE = ("To establish a prima facie case of retaliation, the plaintiff must show that she engaged in protected "
          "activity, that she suffered a materially adverse action, and that a causal link exists between them.")


def test_grounding_check_accepts_supported_sentences_only():
    good = "A retaliation plaintiff must show protected activity, a materially adverse action and a causal link."
    assert support(good, SOURCE) > 0.8 and acceptable(good, SOURCE)
    assert not acceptable("A plaintiff must prove pregnancy discrimination under the statute of frauds.", SOURCE)
    assert not acceptable(good[:-1] + ", see 411 U.S. 792.", SOURCE)  # no citations of its own
    assert not acceptable("Short.", SOURCE)


def test_training_pairs_come_from_the_citing_courts_sentence():
    ctx = ("Earlier text. Thus, a plaintiff must show protected activity, a materially adverse action and a causal "
           "link between them. See Burlington N. & Santa Fe Ry. Co. v. White, 548 U.S. 53, 68 (2006).")
    target = proposition(ctx, ["548 U.S. 53"])
    assert target == "A plaintiff must show protected activity, a materially adverse action and a causal link between them."
    passage, score = best_passage(target, [SOURCE, "An unrelated paragraph about pensions and benefits."])
    assert passage.startswith("To establish") and score >= 0.5
    assert proposition("We reverse. Smith v. Jones, 548 U.S. 53.", ["548 U.S. 53"]) is None


def test_extractive_writer_when_disabled(settings):
    assert settings.memo_writer == "extractive" and get_writer(settings) is None
