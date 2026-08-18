import threading
from contextlib import contextmanager

_state = threading.local()


def sync_signals_suppressed() -> bool:
    return bool(getattr(_state, "suppressed", False))


@contextmanager
def suppress_sync_signals():
    previous = sync_signals_suppressed()
    _state.suppressed = True
    try:
        yield
    finally:
        _state.suppressed = previous
