# Reverse SSH Quick Start

## Problem ✗
Console shows "Connecting..." forever because Nexus can't reach nodes directly.

## Solution ✓
Nodes connect **back** to Nexus via reverse SSH tunnel. Instant console access.

---

## 30-Second Setup

### For Combine Mode (Dashboard + local monitoring)
```bash
npm run setup
npm run start:combine
# That's it! Console works automatically.
```

### For Remote Nodes
```bash
# On Nexus server:
npm run setup
npm run start:server

# On each remote node:
./reverse-ssh -v -b 9000 nexus@your-server.com
# Or configure config.json to auto-start
```

---

## How It Works

```
Before (broken):
  Dashboard → (tries to reach node) ✗ HANGS

After (works):
  Node → (connects to server, opens tunnel) → Dashboard (connects locally)
  ✓ INSTANT CONNECTION
```

---

## Key Files Modified

- **src/utils/reverse-ssh-tunnel.js** ← NEW: Tunnel manager
- **src/api/ssh-terminal.js** ← NEW: connectReverse() method  
- **src/api/websocket.js** ← UPDATED: Smart routing to tunnels
- **src/modes/node.js** ← UPDATED: Auto-start reverse-ssh
- **src/modes/combine.js** ← UPDATED: Configure for localhost
- **src/api/routes/console.js** ← UPDATED: Tunnel API endpoints
- **config/config.default.json** ← UPDATED: New settings
- **setup.sh** ← UPDATED: Auto-download binary
- **REVERSE_SSH_GUIDE.md** ← NEW: Full documentation

---

## Configuration

Update `config/config.json`:
```json
{
  "node": {
    "enableReverseTunnel": true,
    "serverHost": "your-nexus-server.com",
    "serverSSHPort": 22,
    "reverseUsername": "nexus",
    "reversePassword": "change-me-in-production!",
    "reverseLocalPort": 9000,
    "autoRestartReverseTunnel": true
  }
}
```

---

## Check Tunnel Status

```bash
curl http://localhost:8080/api/console/reverse-ssh/status

# Output shows active tunnels:
{
  "success": true,
  "tunnels": [
    {
      "nodeId": "node-123",
      "localPort": 9000,
      "active": true,
      "uptime": 3600000
    }
  ]
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Console still "Connecting" | Check tunnel status above |
| Tunnel won't start | Verify network connectivity to server |
| Binary not found | Run `npm run setup` to download |
| Permission denied | `chmod +x ./reverse-ssh` |
| Port in use | Change `reverseLocalPort` in config |

---

## More Information

See [REVERSE_SSH_GUIDE.md](./REVERSE_SSH_GUIDE.md) for:
- Complete setup guide
- Architecture details  
- API reference
- Security recommendations
- Systemd service setup
- Performance tuning

See [IMPLEMENTATION_REVERSE_SSH.md](./IMPLEMENTATION_REVERSE_SSH.md) for:
- Technical implementation details
- Code changes summary
- Deployment scenarios
- Migration guide
