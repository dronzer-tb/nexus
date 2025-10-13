#!/usr/bin/env python3
"""Nexus single-file program that can run as Agent or Server.

Run with:
  python nexus.py --mode agent
  python nexus.py --mode server

This scaffold includes placeholders and simple implementations for:
- mode detection
- ASCII art startup
- Agent: periodic metrics sending (psutil)
- Server: FastAPI app with placeholder endpoints
- config loading from .env or config.json
- simple logging

Expand this scaffold to add real DB and security features.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import platform
import sys
from dataclasses import dataclass
from typing import Any, Dict, Optional

# Optional imports (installed via requirements)
try:
    import psutil
except Exception:  # pragma: no cover - optional
    psutil = None

try:
    import requests
except Exception:  # pragma: no cover - optional
    requests = None

try:
    from fastapi import FastAPI, WebSocket, Request
    from fastapi.staticfiles import StaticFiles
    import uvicorn
except Exception:  # pragma: no cover - optional
    FastAPI = None
    WebSocket = None
    Request = None
    StaticFiles = None
    uvicorn = None

# ASCII art
ASCII_SERVER = r"""
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
"""

ASCII_AGENT = r"""
   .-._   _ _ _ _ _ _ _
 .-"     "  .-"  .-"  .-"
/  .-""-.  /  .-"  /  .-""-.
\ (  \  )/    \  (  (  \  )
 `-`--'`      `-`--'` `-`--'
        Dronzer Studios - Agent v1.0.0
"""

CONFIG_FILE = "config.json"
ENV_FILE = ".env"

logger = logging.getLogger("nexus")


@dataclass
class Config:
    mode: str = "agent"
    server_url: str = "http://localhost:8000"
    api_key: Optional[str] = None
    db_path: str = "db/nexus.db"
    heartbeat_interval: int = 10


def load_config() -> Config:
    # Load from .env if exists
    cfg = Config()
    if os.path.exists(ENV_FILE):
        try:
            from dotenv import load_dotenv

            load_dotenv(ENV_FILE)
            cfg.mode = os.getenv("NEXUS_MODE", cfg.mode)
            cfg.server_url = os.getenv("NEXUS_SERVER_URL", cfg.server_url)
            cfg.api_key = os.getenv("NEXUS_API_KEY", cfg.api_key)
            cfg.db_path = os.getenv("NEXUS_DB_PATH", cfg.db_path)
            cfg.heartbeat_interval = int(os.getenv("NEXUS_HEARTBEAT_INTERVAL", cfg.heartbeat_interval))
        except Exception:
            logger.exception("Failed to load .env")

    # Override with config.json if present
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for k, v in data.items():
                if hasattr(cfg, k):
                    setattr(cfg, k, v)
        except Exception:
            logger.exception("Failed to load config.json")

    return cfg


# ---------------- Agent helpers -----------------

async def collect_metrics() -> Dict[str, Any]:
    """Collect basic host metrics using psutil. Returns a JSON-serializable dict."""
    if psutil is None:
        return {"error": "psutil not installed"}

    try:
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()._asdict()
        disk = {p.mountpoint: psutil.disk_usage(p.mountpoint)._asdict() for p in psutil.disk_partitions(all=False)}
        net = psutil.net_io_counters(pernic=False)._asdict()
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                procs.append(p.info)
            except Exception:
                continue
        return {
            "hostname": platform.node(),
            "cpu_percent": cpu,
            "memory": mem,
            "disk": disk,
            "network": net,
            "processes": procs,
        }
    except Exception:
        logger.exception("Failed to collect metrics")
        return {"error": "collect_failed"}


async def agent_loop(cfg: Config) -> None:
    """Main agent loop: collect and send metrics periodically."""
    print(ASCII_AGENT)
    print(f"Mode: Agent | Sending to: {cfg.server_url}")

    if requests is None:
        logger.warning("requests not installed; agent cannot send data")

    session = requests.Session() if requests else None

    while True:
        metrics = await collect_metrics()
        payload = {"api_key": cfg.api_key, "metrics": metrics}
        try:
            if session:
                url = cfg.server_url.rstrip("/") + "/api/agent/update"
                resp = session.post(url, json=payload, timeout=5)
                logger.debug("Agent posted metrics: %s", resp.status_code)
            else:
                logger.info("Collected metrics (not sent): %s", metrics)
        except Exception:
            logger.exception("Failed to send metrics to server")
        await asyncio.sleep(cfg.heartbeat_interval)


# ---------------- Server helpers -----------------

def create_app(cfg: Config):
    """Create a FastAPI app with placeholder endpoints."""
    if FastAPI is None:
        raise RuntimeError("FastAPI is not installed")

    app = FastAPI(title="Nexus Server")

    # In-memory store for demo
    AGENTS: Dict[str, Dict[str, Any]] = {}
    # simple admin store
    try:
        from db import admin_store
    except Exception:
        admin_store = None
    try:
        from db import admin_store as astore
    except Exception:
        astore = None

    # simple token store
    TOKENS_PATH = os.path.join(os.getcwd(), "db", "tokens.json")
    if os.path.exists(TOKENS_PATH):
        try:
            with open(TOKENS_PATH, "r", encoding="utf-8") as f:
                TOKENS = json.load(f)
        except Exception:
            TOKENS = {}
    else:
        TOKENS = {}

    @app.post("/api/agent/update")
    async def agent_update(request: Request):
        body = await request.json()
        api_key = body.get("api_key")
        metrics = body.get("metrics")
        agent_id = metrics.get("hostname") if isinstance(metrics, dict) else "unknown"
        AGENTS[agent_id] = {"metrics": metrics}
        return {"status": "ok", "agent_id": agent_id}

    @app.post("/api/agent/connect")
    async def agent_connect(payload: Dict[str, Any]):
        """Agent calls this to register/connect with an api_token (simple flow).
        Payload: {"api_token": "...", "hostname": "..."}
        """
        token = payload.get("api_token")
        hostname = payload.get("hostname") or "unknown"
        # For demo accept any non-empty token and store agent
        if not token:
            return {"error": "api_token_required"}
        AGENTS[hostname] = {"token": token, "connected": True}
        return {"status": "connected", "agent": hostname}

    @app.get("/api/agent/list")
    async def agent_list():
        return {"agents": list(AGENTS.keys())}

    @app.get("/api/agent/{agent_id}")
    async def agent_get(agent_id: str):
        return AGENTS.get(agent_id, {"error": "not_found"})

    @app.post("/api/agent/command")
    async def agent_command(payload: Dict[str, Any]):
        # Placeholder: in a real system you'd enqueue commands for agents
        return {"status": "queued", "payload": payload}

    @app.post("/api/admin/login")
    async def admin_login(payload: Dict[str, Any]):
        # Very small demo auth: verify username/password against admin_store
        username = payload.get("username")
        password = payload.get("password")
        if astore:
            admin = astore.load_admin()
            if not admin:
                return {"error": "no_admin"}
            # verify password using utils.auth
            try:
                from utils import auth

                ok = auth.verify_password(password, admin.get("password", ""))
            except Exception:
                ok = False
            if ok and username == admin.get("username"):
                return {"status": "ok"}
        return {"error": "invalid_credentials"}

    @app.post("/api/admin/token")
    async def admin_token(payload: Dict[str, Any]):
        # Create a node token which can be used to connect agents
        name = payload.get("name") or "node"
        token = payload.get("token") or os.urandom(16).hex()
        TOKENS[name] = token
        # persist
        try:
            os.makedirs(os.path.join(os.getcwd(), "db"), exist_ok=True)
            with open(TOKENS_PATH, "w", encoding="utf-8") as f:
                json.dump(TOKENS, f, indent=2)
        except Exception:
            pass
        return {"status": "created", "name": name, "token": token}

    @app.websocket("/api/live")
    async def live_ws(ws: WebSocket):
        await ws.accept()
        try:
            while True:
                await ws.send_json({"message": "ping"})
                await asyncio.sleep(5)
        except Exception:
            pass

    # Serve static files from public/ if available
    public_dir = os.path.join(os.getcwd(), "public")
    if StaticFiles is not None and os.path.isdir(public_dir):
        app.mount("/", StaticFiles(directory=public_dir, html=True), name="public")

    return app


def server_run(cfg: Config) -> None:
    print(ASCII_SERVER)
    print(f"Mode: Server | Listening on 0.0.0.0:8000 | DB: {cfg.db_path}")
    app = create_app(cfg)
    uvicorn.run(app, host="0.0.0.0", port=8000)


# ---------------- CLI / Entrypoint -----------------

def setup_logging(debug: bool = False) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Nexus single program (Agent or Server)")
    parser.add_argument("--mode", choices=("agent", "server"), help="Run mode", default=None)
    parser.add_argument("--config", help="Path to config.json", default=CONFIG_FILE)
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    setup_logging(args.debug)
    cfg = load_config()
    # CLI arg overrides
    if args.mode:
        cfg.mode = args.mode

    # If no CLI mode provided, prompt interactively
    if not args.mode:
        print("Select mode to run:")
        print("  1) Agent")
        print("  2) Server")
        print("  3) Agent + Server (both)")
        choice = input("Enter choice [1]: ") or "1"
        mapping = {"1": "agent", "2": "server", "3": "both"}
        cfg.mode = mapping.get(choice, "agent")

    # Check dependencies for selected mode and offer to install
    try:
        from utils.deps import ensure_for_mode

        ok, missing = ensure_for_mode(cfg.mode)
        if not ok:
            logger.warning("Missing dependencies: %s", missing)
    except Exception:
        logger.debug("Dependency checker not available")

    try:
        if cfg.mode == "agent":
            asyncio.run(agent_loop(cfg))
        elif cfg.mode == "server":
            server_run(cfg)
        elif cfg.mode == "both":
            # Run server in background thread via uvicorn server and agent loop concurrently
            # We'll run uvicorn in an asyncio task using Config.create_server
            async def both():
                # Run server in a background thread
                loop = asyncio.get_event_loop()

                def start_uvicorn():
                    server_run(cfg)

                from concurrent.futures import ThreadPoolExecutor

                with ThreadPoolExecutor(max_workers=1) as ex:
                    fut = loop.run_in_executor(ex, start_uvicorn)
                    # give server a moment to start
                    await asyncio.sleep(1)
                    # start agent loop
                    agent_task = asyncio.create_task(agent_loop(cfg))
                    await agent_task

            asyncio.run(both())
        else:
            print("Unknown mode. Use --mode agent|server")
    except KeyboardInterrupt:
        print("Exiting")


if __name__ == "__main__":
    main()
