# Changelog

All notable changes to Nexus are documented here.

---

## v2.2.6

- **Fix: Reverse-SSH Disabled by Default** — Reverse SSH tunnel no longer starts automatically, preventing infinite EACCES retry loops that caused 100% CPU on nodes
- **Fix: CORS Blocking Onboarding** — CORS now allows all origins during initial onboarding (before nginx config is set), and no longer hard-rejects unknown origins in production
- **Fix: Systemd WorkingDirectory** — `install_systemd_service()` now resolves the install path from `BASH_SOURCE` instead of `$(pwd)`, preventing `getcwd() failed` errors
- **Fix: Nginx Wizard Hanging** — Added non-interactive mode to `wizard.js` so it completes instantly when called from `setup.sh` with `--domain`, `--ssl`, `--port` args instead of blocking on readline prompts
- **Fix: Nginx Port Mismatch Prevention** — `writeNginxConfig()` now detects existing Certbot-modified configs and updates only `proxy_pass` port in-place; new `sync_nginx_port()` in `setup.sh` scans all nginx configs post-install
- **Fix: Input Pattern Regex** — Escaped hyphen in `[a-zA-Z0-9_\-]+` pattern for `v`-flag compatibility in modern browsers
- **Fix: Onboarding Error Messages** — Step 1 handler now returns actual error messages instead of generic "Internal server error"; frontend displays detailed errors
- **Fix: TUI Menu Duplication** — Cursor-up calculation now includes blank and hint lines, preventing menu options from rendering twice
- **Fix: TUI Arrow Menu Crash** — Added `|| true` guards to `read` and arithmetic in setup.sh to prevent `set -e` from killing the script
- **Fix: TUI Menu Hanging on VPS** — Replaced `\033[6n` cursor position query with relative `\033[nA` movement for terminal compatibility

---

## v2.2.3

- **Full TUI Redesign (v4.0)** — Ground-up rewrite of the interactive installer: replaced the split-panel box-drawing layout with a clean, full-width centered design featuring 256-color gradient accents, animated braille spinners, and a step-dot progress indicator
- **Arrow-Key Menu Navigation** — All menus are now navigated with ↑/↓ arrow keys and Enter instead of typing numbers; selected option is highlighted with a `❯` cursor
- **Tailscale VPN Support** — New "Networking & Access" setup step offers Tailscale as an access method alongside Nginx and direct IP; auto-detects installed tools, can install Tailscale inline, and optionally configures API key + tailnet
- **Web Console Setup** — Dedicated setup step for enabling/disabling the SSH web console and configuring sudo access, with clear security descriptions
- **Animated Install Spinners** — Each install phase (npm install, dashboard build, reverse-ssh download) shows a smooth braille-dot spinner instead of static text
- **Configuration Review Step** — Clean summary table before install with back-navigation to change any setting
- **Architecture-Aware Reverse-SSH** — Binary selection for Linux (x86_64, i686, aarch64) and macOS (amd64, arm64) with graceful fallback
- **Min Terminal Size Check** — Exits gracefully with a message if terminal is smaller than 60×24

---

## v2.2.2

- **Fix: Nginx Wizard Port Override** — Setup wizard no longer re-asks for the backend port when called from `setup.sh`; the port chosen in the main installer is now passed via `--port` CLI arg, preventing config overwrites
- **Fix: HTML Error Log Flooding** — Node registration and metrics errors now extract the page title from HTML responses (e.g., `"502: Bad gateway"`) instead of dumping the entire Cloudflare error page into logs
- **QR Scanner Rewrite** — Replaced `expo-camera` + ML Kit barcode scanner (~20 MB) with `expo-image-picker` (system camera) + `jsqr` (pure JS decoder); eliminates heavy native dependency and works reliably across all Android versions
- **Removed RECORD_AUDIO Permission** — Mobile app no longer requests microphone access (was unused leftover from expo-camera)

---

## v2.2.1

- **Simplified Add Node Flow** — Replaced 3-step instructions with a single copy-paste command in the Add Node modal
- **Systemd Service Installer** — `node src/index.js --mode=node --install-service` auto-creates, enables, and starts a systemd unit for the node; auto-detects user, working directory, and node binary
- **Faster Alert Polling** — Reduced mobile polling interval from 15s to 8s for quicker notification delivery
- **SecureStore Key Fix** — Removed invalid `@` prefix from notification storage keys that caused save failures in Expo Go

---

## v2.2.0

- **Push Notifications (No FCM)** — Local polling-based push notification system for the Android app; polls server every 15s for new alerts and fires local notifications via `expo-notifications` — zero Firebase dependency
- **Server Alert History** — New `alert_history` SQLite table with full CRUD; stores every warning, critical, and resolved alert with node info, metric values, top process data, and 7-day auto-cleanup
- **Mobile Alert Polling Endpoints** — `GET /api/mobile/alerts/poll?since=<ts>` and `POST /api/mobile/alerts/:alertId/acknowledge` for real-time alert sync
- **Notification Toggle** — New Notifications section in mobile Settings with enable/disable switch and method indicator
- **Unread Alert Badge** — Pink badge on the Alerts tab icon showing unread count, refreshed every 5s
- **Smart Polling Lifecycle** — Auto-pauses polling when app goes to background, resumes on foreground; deduplicates alerts by server ID
- **Pull-to-Refresh Polling** — AlertFeedScreen triggers a server poll on pull-to-refresh and screen focus
- **Notification Tap Navigation** — Tapping a notification navigates directly to the Alerts tab

---

## v2.1.0-beta

- **Responsive Dashboard** — Fully adaptive layout across all pages; mobile drawer navigation with hamburger menu, responsive typography (`text-3xl` → `text-6xl` scaling), flex-wrap on button groups, stacking grids on small screens
- **Interactive Discord Alert Buttons** — Warning/critical alerts now include **False Alarm** (🔕 dismiss) and **Tail** (📡 live stream) buttons directly in the Discord DM embed
- **Live Tail to Discord** — Clicking "Tail" streams real-time metrics and top 5 processes to your DMs every 10 seconds for 2 minutes
- **Top Process in Alerts** — CPU/memory spike notifications now include the process causing the spike (name, PID, CPU%, MEM%, command)
- **Responsive Pages Fixed:**
  - `Dashboard.jsx` — Mobile drawer sidebar, hamburger toggle, responsive padding
  - `Overview.jsx` — Responsive heading, wrapping header
  - `AgentsList.jsx` — Flex-based node rows replacing fixed `grid-cols-12`, wrapping header buttons
  - `AgentDetails.jsx` — Wrapping header buttons, responsive process table
  - `Console.jsx` — Stacking sidebar/terminals vertically on mobile
  - `NodeProcesses.jsx` — Touch-friendly action buttons (always visible on mobile), responsive table
  - `Logs.jsx` — Responsive heading
  - `Settings.jsx` — Responsive heading, flex-wrap on sub-tabs and button groups

---

## v2.0.0-pre-release

- **Native Tailscale Support** — Zero-config networking as an alternative to nginx; auto-detects Tailscale IP, optional API integration for device management
- **Docker Support** — Multi-stage Dockerfile, Docker Compose config, `docker-entrypoint.sh` with environment variable overrides
- **TUI Setup Revamp** — Box-styled layout with back-button navigation, progress bar, `--bypass-mode` (red-themed TUI)
- **Per-Node Alert Thresholds** — Independent CPU/memory/disk thresholds per node with API management; falls back to global defaults
- **Discord Bot Onboarding** — Discord bot replaces webhooks in the setup wizard flow
- **Bypass Mode** — `./setup.sh --bypass-mode` for alternative installer experience
- **Repo Cleanup** — Removed stale files and streamlined project structure

---

## v1.9.6

- **SSH Terminal** — Built-in web terminal for remote command execution via xterm.js
- **TUI Setup Script** — Interactive `setup.sh` wizard for first-time configuration
- **Reverse SSH Tunnels** — Access nodes behind NAT/firewalls with auto-reconnection
- **Mobile App Pairing** — QR code–based pairing between React Native app and server
- **Console Combine Mode Fix** — Local PTY detection for combine mode terminals

---

## v1.9.5

- **Mandatory 2FA** — TOTP-based two-factor authentication required for all users
- **Audit Logging** — Comprehensive security event logging with 90-day retention
- **Console 2FA Gate** — Additional TOTP verification before remote command execution
- **Enhanced Auth System** — Recovery codes, rate limiting on 2FA attempts

---

## v1.9.1

- **API Key Authentication** — Secure node-to-server communication via X-API-Key headers
- **Role-Based Access Control** — Admin, viewer, and operator roles with permission enforcement
