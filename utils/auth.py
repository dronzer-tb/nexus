"""Authentication helpers for Nexus: password hashing and verification."""
from typing import Optional

try:
    import bcrypt
except Exception:  # pragma: no cover
    bcrypt = None


def hash_password(password: str) -> str:
    if bcrypt:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    import hashlib

    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    if bcrypt:
        try:
            return bcrypt.checkpw(password.encode(), hashed.encode())
        except Exception:
            return False
    import hashlib

    return hashlib.sha256(password.encode()).hexdigest() == hashed
