"""Build STARE-Gen training data from the citation network of the corpus.

For every citation edge (a later opinion citing an earlier one) the stored context holds the citing court's text
around the citation. When that text has the common form "<rule sentence>. <Case name>, <cite>", the rule sentence
is what the citing court took from the cited opinion. It becomes the target; the passage of the cited opinion
that best matches it becomes the source. A pair is kept only if most of the sentence's content words appear in
the passage, so the model learns to state rules the source supports. Examples are split by cited opinion, so
test passages come from opinions never seen in training.
"""

from __future__ import annotations

import json
import random
import re
import zlib
from collections import defaultdict
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from stare.config import REPO_DIR
from stare.db.models import Chunk, Citation, CitationEdge, Opinion
from stare.gen.prompt import content_words, support
from stare.text import split_sentences

GEN_DIR = REPO_DIR / "data" / "gen"

_SIGNAL_CASE = re.compile(r"^(?:See|see|See also|See, e\.g\.,|Cf\.|Accord|E\.g\.,|See generally)?\s*[^;]{0,140}?\bv\.\s[^;]{1,120}$")
_REPORTER = re.compile(r"\b\d{1,4}\s+(?:U\.\s?S\.|S\.\s?Ct\.|L\.\s?Ed|F\.\s?\d?d?|F\.\s?Supp|F\.\s?App)")
_BAD = re.compile(r"\b(?:we|our|us|here|appellants?|appellees?|petitioners?|respondents?|the district court|"
                  r"this case|the jury|the panel|Id\.|supra|infra|footnote)\b|\bI\b", re.IGNORECASE)
_OPENER = re.compile(r"^(?:Thus|Accordingly|Therefore|Moreover|Indeed|Further(?:more)?|In short|In other words|"
                     r"First|Second|Third|Finally|Instead|Rather|Nevertheless|However|Similarly|Likewise),\s+")
_HEADING = re.compile(r"^(?:[A-Z][\w'-]*\s){1,5}(?:To|A|An|The|In|Under|Because|Although|When|If|Where)\s")
_RULE_VERB = re.compile(r"\b(?:must|may|need|needs|requires?|required|is|are|cannot|can|shall|establish(?:es)?|"
                        r"means|includes?|prohibits?|permits?)\b")


def _cite_pattern(cite: str) -> re.Pattern:
    parts = [p for p in re.split(r"[\s.]+", cite.strip()) if p]
    return re.compile(r"[\s.]*".join(re.escape(p) for p in parts))


def proposition(context: str, cites: list[str]) -> str | None:
    """The sentence a citing court wrote just before its citation to the cited case, if it has that form."""
    pos = None
    for c in cites:
        m = _cite_pattern(c).search(context)
        if m and (pos is None or m.start() < pos):
            pos = m.start()
    if pos is None:
        return None
    sents = split_sentences(context[:pos])
    if len(sents) < 2:
        return None
    tail, prop = sents[-1].strip(), sents[-2].strip()
    if not _SIGNAL_CASE.match(tail):  # the citation is inside a sentence, not after it
        return None
    prop = re.sub(r"^[\"“”'(\[]+", "", " ".join(prop.split()))
    prop = re.sub(r"^[A-Z0-9]\.?\s+(?=[A-Z])", "", prop)  # a stray heading letter: "A The language ..."
    prop = _OPENER.sub("", prop)
    prop = prop[:1].upper() + prop[1:]
    if not 60 <= len(prop) <= 320 or not prop[0].isupper() or not prop.endswith("."):
        return None
    if _HEADING.match(prop):  # a section heading run into the sentence: "Retaliation Claim To prevail ..."
        return None
    if _REPORTER.search(prop) or " v. " in prop or _BAD.search(prop) or not _RULE_VERB.search(prop):
        return None
    if prop.count('"') % 2 or prop.count("“") != prop.count("”"):
        return None
    return prop


def best_passage(target: str, chunks: list[str], words: int = 140) -> tuple[str, float]:
    """The window of about `words` words in the cited opinion that best supports the target sentence."""
    want = content_words(target)
    best, best_score = "", 0.0
    for text in chunks:
        sents = split_sentences(text)
        for i in range(len(sents)):
            window, n, j = [], 0, i
            while j < len(sents) and n < words:
                window.append(sents[j])
                n += len(sents[j].split())
                j += 1
            w = " ".join(window)
            score = len(want & content_words(w)) / max(1, len(want))
            if score > best_score:
                best, best_score = w, score
    return " ".join(best.split()[: words + 30]), best_score


def build(session: Session, out_dir: Path | None = None, *, min_support: float = 0.5, max_train: int = 6000,
          seed: int = 0, say: Callable[[str], None] = lambda s: None) -> dict:
    out = out_dir or GEN_DIR
    out.mkdir(parents=True, exist_ok=True)
    cites: dict[int, list[str]] = defaultdict(list)
    for oid, cite in session.execute(select(Citation.opinion_id, Citation.cite)):
        cites[oid].append(cite)
    names = dict(session.execute(select(Opinion.id, Opinion.case_name)).all())
    edges = session.execute(select(CitationEdge.citing_id, CitationEdge.cited_id, CitationEdge.context)
                            .where(CitationEdge.context != "")).all()
    say(f"{len(edges)} citation edges with context")
    props: dict[int, list[tuple[int, str]]] = defaultdict(list)
    seen: set[tuple[int, str]] = set()
    for citing, cited, ctx in edges:
        p = proposition(ctx or "", cites.get(cited, []))
        if p and (cited, p) not in seen:
            seen.add((cited, p))
            props[cited].append((citing, p))
    say(f"{sum(map(len, props.values()))} rule sentences found before a citation, for {len(props)} cited opinions")

    examples = []
    for n, (cited, items) in enumerate(props.items(), 1):
        chunks = list(session.scalars(select(Chunk.text).where(Chunk.opinion_id == cited, Chunk.part == "majority")))
        if not chunks:
            continue
        for citing, target in items:
            passage, score = best_passage(target, chunks)
            if score >= min_support and passage:
                examples.append({"source": passage, "case": names.get(cited, ""), "target": target,
                                 "support": round(support(target, passage), 3), "cited_id": cited,
                                 "citing_id": citing})
        if n % 500 == 0:
            say(f"  {n}/{len(props)} cited opinions, {len(examples)} examples kept")

    split = {"train": [], "dev": [], "test": []}
    for ex in examples:  # by cited opinion: no test passage comes from an opinion seen in training
        h = zlib.crc32(str(ex["cited_id"]).encode()) % 20
        split["test" if h == 0 else "dev" if h == 1 else "train"].append(ex)
    rng = random.Random(seed)
    for rows in split.values():
        rng.shuffle(rows)
    split["train"] = split["train"][:max_train]
    split["dev"] = split["dev"][:300]
    split["test"] = split["test"][:200]
    for k, rows in split.items():
        (out / f"{k}.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
    stats = {"edges_with_context": len(edges), "rule_sentences": sum(map(len, props.values())),
             "examples_kept": len(examples), "min_support": min_support,
             **{f"{k}_examples": len(v) for k, v in split.items()},
             "cited_opinions": len({e["cited_id"] for e in examples})}
    (out / "data_stats.json").write_text(json.dumps(stats, indent=2) + "\n")
    return stats
