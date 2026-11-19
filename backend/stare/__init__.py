"""STARE: a multi-agent AI system for verified US employment-law research."""

from stare._quiet import quiet_ml_imports as _quiet_ml_imports

__version__ = "0.1.0"

DISCLAIMER = (
    "Research material for licensed attorneys. Not legal advice. "
    "Every memo requires review and approval by a licensed attorney."
)

# before spaCy, PyTorch or Transformers are imported anywhere: no download bars, no macOS torch notice
_quiet_ml_imports()
