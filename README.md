
# nexus

Nexus is a self-hosted, modular platform by Dronzer Studios that allows you to monitor and manage multiple systems—VPSs, cloud environments, and local machines—from a single, centralized interface.

## Nexus (single program)

This workspace contains a single Python program (`nexus.py`) that can run in Agent, Server, or combined (Agent+Server) mode.

Quick start

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Run the installer to create `.env` and optionally an admin user:

```bash
python installer.py
```

3. Run Nexus interactively (choose Agent, Server, or Both):

```bash
python nexus.py
```

Important files

- `nexus.py` - main program (agent/server/both)
- `installer.py` - interactive installer (creates `.env` and admin user)
- `public/` - mock front-end HTML files
- `public/js/app.js` - minimal client JS wiring UI to backend endpoints
- `db/` - simple file-based storage (admin.json, tokens.json)

Notes

- Front-end UIs in `public/` are mockups; `app.js` implements simple fetch calls to backend endpoints for login, token creation, and agent connect.
- The dependency helper `utils/deps.py` will offer to install missing Python packages.
- This scaffold is for development and demonstration only. Do not use in production without securing admin/endpoints and using TLS.
