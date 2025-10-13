#!/usr/bin/env python3
"""Simple CLI installer for Nexus with ASCII art and basic prompts.

This script creates a .env file and a config.json template.
Run: python installer.py
"""
import json
import os

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
    print("Installation complete. Run 'python nexus.py --mode agent' or '--mode server'")


if __name__ == "__main__":
    main()
