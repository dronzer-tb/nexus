"""Dependency checker and installer helpers.

Provides functions to detect missing Python packages (by import name)
and offer the user an option to install them using pip.
"""
from typing import List, Tuple
import importlib
import subprocess
import sys


PACKAGE_MAP: List[Tuple[str, str]] = [
    ("psutil", "psutil"),
    ("requests", "requests"),
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("python-dotenv", "dotenv"),
    ("bcrypt", "bcrypt"),
]


def check_missing(packages: List[Tuple[str, str]]) -> List[str]:
    """Return list of pip package names that are missing from the environment."""
    missing = []
    for pip_name, import_name in packages:
        try:
            importlib.import_module(import_name)
        except Exception:
            missing.append(pip_name)
    return missing


def install_packages(packages: List[str]) -> Tuple[bool, List[str]]:
    """Attempt to install packages via pip. Returns (all_ok, failed_list)."""
    if not packages:
        return True, []
    cmd = [sys.executable, "-m", "pip", "install", *packages]
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd)
    if res.returncode == 0:
        return True, []
    # If pip returned non-zero, we can try to detect which are still missing
    still_missing = check_missing([(p, p if p != 'python-dotenv' else 'dotenv') for p in packages])
    return False, still_missing


def ensure_for_mode(mode: str) -> Tuple[bool, List[str]]:
    """Ensure packages required for a given mode are available; offer to install.

    mode: 'agent', 'server', 'both', or 'installer'
    Returns (ok, missing_after)
    """
    reqs = []
    if mode == "agent":
        reqs = [p for p in PACKAGE_MAP if p[0] in ("psutil", "requests")]
    elif mode == "server":
        reqs = [p for p in PACKAGE_MAP if p[0] in ("fastapi", "uvicorn", "python-dotenv", "requests")]
    elif mode == "both":
        reqs = PACKAGE_MAP
    elif mode == "installer":
        reqs = [("bcrypt", "bcrypt")]
    else:
        reqs = PACKAGE_MAP

    missing = check_missing(reqs)
    if not missing:
        return True, []

    print("Missing Python packages detected:", ", ".join(missing))
    ans = input("Install missing packages now? [Y/n]: ") or "y"
    if ans.lower() in ("y", "yes"):
        ok, still = install_packages(missing)
        if ok:
            print("Packages installed.")
            return True, []
        print("Some packages failed to install:", ", ".join(still))
        return False, still
    else:
        print("Skipping installation; some features may not work.")
        return False, missing
