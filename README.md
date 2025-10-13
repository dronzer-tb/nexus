
# nexus

Nexus is a self-hosted, modular platform by Dronzer Studios that allows you to monitor and manage multiple systems—VPSs, cloud environments, and local machines—from a single, centralized interface.

## Available Implementations

Nexus is available in two implementations:
- **Node.js/TypeScript** (recommended) - Modern, async, better performance
- **Python** - Original implementation

## Nexus (Node.js/TypeScript)

This workspace contains a TypeScript program that can run in Agent, Server, or combined (Agent+Server) mode.

### Quick start (Node.js)

1. One-line install and run:

```bash
./install_and_run_node.sh both
```

Or manually:

1. Install dependencies and build:

```bash
npm install
npm run build
```

2. Run the installer:

```bash
node dist/installer.js
```

3. Start Nexus (interactive mode selection or use --mode):

```bash
npm start
# or
node dist/index.js --mode both
```

---

## Nexus (Python - Legacy)

Quick start (Python)

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
