#!/usr/bin/env python3
"""Simple CLI installer for Nexus with ASCII art and basic prompts.

This script creates a .env file and a config.json template.
Run: python installer.py
"""
import json
import os
import getpass
from typing import Optional

try:
    import bcrypt
except Exception:
    bcrypt = None

ASCII = r"""
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

Dronzer Studios - Nexus Installer
"""

ENV_FILE = ".env"
CONFIG_FILE = "config.json"


def main():
    print(ASCII)
    mode = input("Default mode (agent/server) [agent]: ") or "agent"
    server_url = input("Server URL [http://localhost:8000]: ") or "http://localhost:8000"
    api_key = input("API Key (optional): ") or ""

    env_content = []
    env_content.append(f"NEXUS_MODE={mode}")
    env_content.append(f"NEXUS_SERVER_URL={server_url}")
    if api_key:
        env_content.append(f"NEXUS_API_KEY={api_key}")

    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(env_content))

    config_template = {
        "mode": mode,
        "server_url": server_url,
        "api_key": api_key,
        "db_path": "db/nexus.db",
        "heartbeat_interval": 10,
    }

    if not os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_template, f, indent=2)
        print(f"Wrote {CONFIG_FILE}")
    else:
        print(f"{CONFIG_FILE} already exists; not overwriting")

    print(f"Wrote {ENV_FILE}")
    # Prompt to create admin account
    def ask_admin() -> Optional[dict]:
        create = input("Create admin user now? (y/N): ") or "n"
        if create.lower() != "y":
            return None
        username = input("Admin username [admin]: ") or "admin"
        pw = getpass.getpass("Password: ")
        pw2 = getpass.getpass("Confirm Password: ")
        if pw != pw2:
            print("Passwords did not match; skipping admin creation")
            return None
        if bcrypt:
            hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
        else:
            # fallback (not secure)
            import hashlib

            hashed = hashlib.sha256(pw.encode()).hexdigest()
        return {"username": username, "password": hashed}

    # Check installer dependencies (bcrypt) before creating admin
    try:
        from utils.deps import ensure_for_mode

        ensure_for_mode("installer")
    except Exception:
        pass

    admin = ask_admin()
    if admin:
        # write to db/admin.json (simple storage)
        db_dir = os.path.join(os.getcwd(), "db")
        os.makedirs(db_dir, exist_ok=True)
        admin_file = os.path.join(db_dir, "admin.json")
        with open(admin_file, "w", encoding="utf-8") as f:
            json.dump(admin, f, indent=2)
        print(f"Wrote admin user to {admin_file}")

    print("Installation complete. Run 'python nexus.py --mode agent' or '--mode server'")


if __name__ == "__main__":
    main()
