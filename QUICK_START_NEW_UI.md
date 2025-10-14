# Quick Start - New Nexus UI

## Installation

Run the setup script to install all dependencies and build the dashboard:

```bash
./setup-new-ui.sh
```

Or manually:

```bash
# Install backend dependencies
npm install

# Install and build dashboard
cd dashboard
npm install
npm run build
cd ..
```

## Replace Old Server Mode

```bash
# Backup old server mode
mv src/modes/server.js src/modes/server.backup.js

# Use new server mode
mv src/modes/server-new.js src/modes/server.js
```

## Start Nexus

Start the server:

```bash
npm run start:server
```

The dashboard will be available at: **http://localhost:8080**

## Login

Use the default credentials:
- **Username**: `admin`
- **Password**: `admin123`

**⚠️ Important**: Change the default password after first login!

## Features Available

✅ **Modern UI**: Dark theme with glowing effects matching the mock designs  
✅ **Authentication**: Secure JWT-based login system  
✅ **Overview Dashboard**: Agent cards with CPU gauges, RAM, and storage  
✅ **Agents List**: Table view with real-time metrics  
✅ **Agent Details**: Individual agent monitoring with process list  
✅ **Process Manager**: Kill processes across all agents  
✅ **Command Console**: Execute remote commands with live output  
✅ **System Logs**: Real-time logs with filtering and search  
✅ **WebSocket**: Live updates for all metrics and events  

## Development Mode

To develop the frontend with hot reload:

```bash
cd dashboard
npm run dev
```

Frontend dev server: **http://localhost:5173**

Backend should still run on: **http://localhost:8080**

## Project Structure

```
nexus/
├── dashboard/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React context (auth)
│   │   ├── pages/          # Page components
│   │   └── App.jsx         # Main app component
│   └── dist/               # Built files (after npm run build)
├── src/
│   ├── api/routes/         # API endpoints
│   ├── middleware/         # Express middleware
│   └── modes/              # Server modes
└── setup-new-ui.sh         # Setup script
```

## API Endpoints

All endpoints except `/api/auth/login` require JWT token in Authorization header:

- `POST /api/auth/login` - Login
- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents/:id/execute` - Execute command
- `GET /api/logs` - Get system logs
- `GET /api/commands/history` - Get command history

## WebSocket Events

Dashboard receives:
- `agents:update` - Agent list updates
- `agent:metrics` - Individual agent metrics
- `agent:status` - Agent status changes
- `command:output` - Command execution output
- `log:new` - New log entries

## Troubleshooting

### Dashboard shows "Dashboard not found"
```bash
cd dashboard
npm run build
```

### Can't login
- Check that `admin123` is the correct password
- Verify JWT secret is set in config
- Check browser console for errors

### WebSocket not connecting
- Verify server is running
- Check that token is valid (not expired)
- Look at browser console for connection errors

### No agents showing
- Agents need to connect to the server
- Check that agent mode is running
- Verify WebSocket connection

## Next Steps

1. Change the default admin password
2. Configure JWT secret in production
3. Set up SSL/TLS for production use
4. Configure firewall rules
5. Review security settings

## Documentation

- **Full Guide**: `NEW_UI_GUIDE.md`
- **Dashboard README**: `dashboard/README.md`
- **Main README**: `README.md`

## Support

For issues or questions, refer to the main Nexus documentation.

---

**Powered by Dronzer Studios**
