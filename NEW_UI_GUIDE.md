# Nexus - New UI Implementation Guide

## Overview

This document describes the complete implementation of the new Nexus UI based on the mock designs provided. The new UI features a modern, dark-themed interface with full functionality and real-time updates.

## What Has Been Implemented

### Frontend (React Dashboard)

#### 1. **Authentication System**
- Login page with modern design matching mock-ui/code3.html
- JWT token-based authentication
- Protected routes
- Auto-logout on token expiration
- Context-based auth state management

#### 2. **Pages**

##### Overview Page (`/`)
- Agent cards in grid layout matching mock-ui/code4.html
- CPU usage circular gauge
- RAM and Storage progress bars
- Real-time metric updates
- Online/offline status indicators
- "Add New Agent" placeholder card

##### Agents List Page (`/agents`)
- Table view of all agents matching mock-ui/code2.html
- CPU and RAM progress bars with glow effects
- Network throughput display
- Status indicators (online/offline with pulse animation)
- Sortable columns
- Click to view details

##### Agent Details Page (`/agents/:id`)
- Similar to mock-ui/code.html
- Four metric cards (CPU, Memory, Disk I/O, Network)
- Running processes table
- Quick command console
- Real-time updates via WebSocket

##### Process Manager Page (`/processes`)
- Unified view of all processes across agents
- Agent filter dropdown
- Process details (name, PID, CPU, memory, status)
- Kill process functionality with confirmation
- Color-coded status badges

##### Command Console Page (`/console`)
- Terminal-style output window
- Command history (up/down arrows)
- Agent selector
- Real-time command output
- Command history storage
- Clear output button

##### Logs Page (`/logs`)
- Real-time log streaming
- Level filtering (error, warn, info, debug)
- Search functionality
- Auto-scroll toggle
- Clear logs functionality
- Color-coded log levels
- Timestamp display

#### 3. **Components**

- **Sidebar**: Navigation menu with active state and icons
- **AgentCard**: CPU gauge with circular progress indicator
- **MetricCard**: Stat cards with change indicators
- **ProcessTable**: Reusable process list component
- **AuthContext**: Global authentication state

#### 4. **Styling**
- Tailwind CSS with custom configuration
- Dark theme (background-dark: #101a22)
- Primary color (#0d8bf2) matching mock designs
- Glow effects on active elements
- Custom CPU gauge animation
- Space Grotesk font
- Responsive design

### Backend (Node.js/Express)

#### 1. **API Routes**

##### `/api/auth`
- `POST /login` - User authentication
- `GET /verify` - Token verification
- `POST /change-password` - Password change

##### `/api/agents`
- `GET /` - List all agents
- `GET /:agentId` - Get specific agent details
- `GET /:agentId/processes` - Get agent processes
- `POST /:agentId/processes/:pid/kill` - Kill a process
- `POST /:agentId/execute` - Execute command

##### `/api/commands`
- `GET /history` - Get command history

##### `/api/processes`
- `GET /` - Get all processes (across all agents)

##### `/api/logs`
- `GET /` - Get logs with filtering
- `DELETE /` - Clear logs

#### 2. **Middleware**
- JWT authentication middleware
- CORS configuration
- Request logging
- Error handling

#### 3. **WebSocket (Socket.IO)**

##### Agent Namespace (`/agent`)
- `agent:register` - Agent registration
- `agent:metrics` - Metrics updates
- `command:output` - Command execution output
- `disconnect` - Agent disconnection handling

##### Dashboard Namespace (default)
- JWT authentication for connections
- `agents:update` - Broadcast agent list
- `agent:metrics` - Broadcast individual metrics
- `agent:status` - Broadcast status changes
- `command:output` - Broadcast command output
- `log:new` - Broadcast new logs

#### 4. **Data Storage**
- In-memory agent storage (Map)
- Command history (array, max 500)
- Logs storage (array, max 10000)
- User credentials (bcrypt hashed)

### Security Features

1. **JWT Authentication**: All API routes (except login) require valid JWT token
2. **Password Hashing**: Bcrypt with 10 salt rounds
3. **Token Expiration**: 24 hour token lifetime
4. **WebSocket Auth**: Socket.IO connections authenticated via JWT
5. **CORS**: Configurable CORS policy
6. **Helmet**: Security headers for Express

## File Structure

```
nexus/
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentCard.jsx
│   │   │   ├── MetricCard.jsx
│   │   │   ├── ProcessTable.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── AgentDetails.jsx
│   │   │   ├── AgentsList.jsx
│   │   │   ├── CommandConsole.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Logs.jsx
│   │   │   ├── Overview.jsx
│   │   │   └── ProcessManager.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── package.json
│   └── README.md
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── agents.js
│   │       ├── auth.js
│   │       ├── commands.js
│   │       ├── logs.js
│   │       └── processes.js
│   ├── middleware/
│   │   └── auth.js
│   ├── modes/
│   │   └── server-new.js
│   └── index.js
└── setup-new-ui.sh
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Run the setup script
./setup-new-ui.sh

# Or manually:
npm install
cd dashboard && npm install && npm run build && cd ..
```

### 2. Update Server Mode

Replace the old server mode with the new one:

```bash
mv src/modes/server.js src/modes/server-old.js
mv src/modes/server-new.js src/modes/server.js
```

### 3. Start the Server

```bash
npm run start:server
```

Or for combined mode (server + node):

```bash
npm run start:combine
```

### 4. Access the Dashboard

Open your browser and navigate to:
```
http://localhost:8080
```

Login with:
- **Username**: `admin`
- **Password**: `admin123`

## Configuration

### JWT Secret

Set the JWT secret in your config:

```json
{
  "jwt": {
    "secret": "your-secure-secret-key",
    "expiresIn": "24h"
  }
}
```

### Server Port

Configure the server port:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  }
}
```

## Default Credentials

The system includes one default user:

- **Username**: `admin`
- **Password**: `admin123` (hash: `$2b$10$rQ8YzW7vQ9LqE1YqN5p4.OXE9BqLqH0mY7lK2vN.qZ8L0xP1Y2XnC`)

**⚠️ IMPORTANT**: Change this password in production!

To generate a new password hash:

```javascript
const bcrypt = require('bcrypt');
const password = 'your-new-password';
bcrypt.hash(password, 10, (err, hash) => {
  console.log(hash);
});
```

## Development

### Frontend Development

```bash
cd dashboard
npm run dev
```

The development server will start at `http://localhost:5173` with hot module replacement.

### Backend Development

```bash
npm run dev
```

This uses nodemon to auto-restart on file changes.

## Production Build

1. Build the dashboard:
```bash
cd dashboard
npm run build
```

2. Start the server:
```bash
npm start
```

The dashboard will be served from the `dashboard/dist` directory.

## Testing

### Test Authentication

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Agent List (with token)

```bash
curl http://localhost:8080/api/agents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Troubleshooting

### Dashboard not loading
- Ensure you've run `npm run build:dashboard`
- Check that `dashboard/dist` directory exists
- Verify server is running on correct port

### WebSocket not connecting
- Check browser console for errors
- Verify JWT token is being sent in auth header
- Ensure Socket.IO CORS is configured correctly

### Authentication failing
- Verify JWT secret is set correctly
- Check token expiration time
- Ensure bcrypt password hash is correct

## Future Enhancements

1. **Database Integration**: Move from in-memory storage to persistent database
2. **User Management**: Add/edit/delete users, role-based access control
3. **Charts**: Add Chart.js integration for historical metrics
4. **Notifications**: Real-time alerts and notifications
5. **Agent Groups**: Organize agents into groups
6. **Scheduled Tasks**: Create and manage scheduled commands
7. **File Transfer**: Upload/download files to/from agents
8. **Terminal Emulation**: Full terminal emulation with SSH
9. **Multi-language**: i18n support
10. **Dark/Light Theme Toggle**: User preference for theme

## License

MIT License - Dronzer Studios

## Support

For issues or questions, please refer to the main Nexus documentation or contact Dronzer Studios.
