"""HTTP helper utilities for Nexus (small wrapper around requests).

Keep this lightweight; in the future you can switch to aiohttp for async.
"""
from typing import Any, Dict, Optional

try:
    import requests
except Exception:  # pragma: no cover
    requests = None


def post_json(url: str, payload: Dict[str, Any], timeout: int = 5) -> Optional[requests.Response]:
    if requests is None:
        raise RuntimeError("requests is not installed")
    return requests.post(url, json=payload, timeout=timeout)
