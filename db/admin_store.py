"""Simple admin store for Nexus (file-based JSON)."""
import json
from pathlib import Path
from typing import Optional

ADMIN_PATH = Path.cwd() / "db" / "admin.json"


def load_admin() -> Optional[dict]:
    if not ADMIN_PATH.exists():
        return None
    try:
        return json.loads(ADMIN_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def ensure_admin(username: str, password_hash: str) -> None:
    ADMIN_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {"username": username, "password": password_hash}
    ADMIN_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")