"""Prompt format and the grounding check shared by training, evaluation and the Memo Agent."""

from __future__ import annotations

import re

SYSTEM = (
    "You write one sentence of a US legal research memo. State the rule of law that the source passage "
    "supports. Use only the source. Do not add case names, citations, dates or facts that are not in it."
)
MAX_SOURCE_WORDS = 140

_WORD = re.compile(r"[a-z][a-z'-]{2,}")
STOP = {"the", "and", "for", "that", "this", "with", "from", "are", "was", "were", "has", "have", "had", "not", "but", "its", "their", "them", "they", "which", "who", "whom", "whose", "shall", "may", "must", "can", "could", "would", "should", "will", "been", "being", "than", "then", "there", "these", "those", "such", "any", "all", "each", "into", "upon", "under", "over", "also", "only", "other", "more", "most", "some", "what", "when", "where", "while", "because", "about", "between", "after", "before", "during", "court", "courts", "case", "cases", "held", "hold", "holds", "holding", "see", "id", "at", "it's", "our", "we", "his", "her", "him", "she", "he", "you", "your", "one", "two"}


def content_words(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if w not in STOP}


def support(sentence: str, source: str) -> float:
    """Share of the sentence's content words that appear in the source passage (0 to 1)."""
    words = content_words(sentence)
    if not words:
        return 0.0
    return len(words & content_words(source)) / len(words)


def trim_source(text: str, words: int = MAX_SOURCE_WORDS) -> str:
    parts = text.split()
    return " ".join(parts[:words])


def messages(source: str, case_name: str = "") -> list[dict]:
    head = f"Source ({case_name}):" if case_name else "Source:"
    return [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"{head}\n{trim_source(source)}\n\nWrite the rule in one sentence."}]


_CITE = re.compile(r"\b\d{1,4}\s+(?:U\.\s?S\.|S\.\s?Ct\.|L\.\s?Ed\.|F\.\s?(?:2d|3d|4th)|F\.\s?Supp\.|F\.\s?App'x)\s*\d")


def clean_sentence(s: str) -> str:
    s = " ".join(s.split()).strip()
    return s


def acceptable(sentence: str, source: str, min_support: float = 0.6) -> bool:
    """A generated rule sentence is used only if it is one plain sentence, cites nothing itself, and its content
    words are supported by the source passage."""
    s = sentence.strip()
    if not 40 <= len(s) <= 400 or _CITE.search(s) or " v. " in s:
        return False
    if s.count('"') % 2:  # unbalanced quotation
        return False
    return support(s, source) >= min_support
