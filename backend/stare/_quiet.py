"""Keep library start-up noise out of the terminal and avoid needless network calls.

Called just before PyTorch, Transformers or sentence-transformers are imported. It hides download
progress bars and the macOS "Redirects are currently not supported" notice that PyTorch prints on
import; it changes nothing else.
"""

from __future__ import annotations

import logging
import os

_done = False


def quiet_ml_imports() -> None:
    global _done
    if _done:
        return
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    # torch.distributed.elastic logs this notice at import time on every Mac; a filter survives its setLevel()
    logging.getLogger("torch.distributed.elastic.multiprocessing.redirects").addFilter(lambda _record: False)
    _done = True


def load_cached_first(factory, name: str, **kwargs):
    """Build a Hugging Face model from the local cache without contacting the Hub; download only if missing.

    Offline demos then start without network timeouts, and a cached model loads faster.
    """
    try:
        return factory(name, local_files_only=True, **kwargs)
    except Exception:  # not cached yet (first run): download it
        return factory(name, **kwargs)
