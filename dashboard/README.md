# Nexus Dashboard - New UI

A modern, React-based dashboard for the Nexus remote resource management system.

## Features

- **Modern Dark Theme UI**: Sleek dark interface with glowing effects and smooth animations
- **Authentication**: Secure JWT-based login system
- **Real-time Updates**: Live metrics and status updates via WebSocket
- **Agent Management**: Monitor all connected agents with detailed metrics
- **Process Manager**: View and kill processes across all agents
- **Command Console**: Execute commands remotely on agents with live output
- **System Logs**: Comprehensive logging with filtering and search capabilities
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Pages

1. **Login**: Secure authentication page
2. **Overview**: Dashboard showing all agents at a glance with CPU, RAM, and storage metrics
3. **Agents List**: Detailed table view of all agents with metrics and status
4. **Agent Details**: Individual agent view with running processes and quick command execution
5. **Process Manager**: Unified process management across all agents
6. **Command Console**: Remote command execution with history and live output
7. **Logs**: System-wide logging with real-time updates and filtering

## Technology Stack

- **React 18**: Modern React with hooks
- **React Router v6**: Client-side routing
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: Real-time communication
- **Axios**: HTTP client for API requests
- **Chart.js**: Data visualization (optional)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Setup

1. Install dependencies:
```bash
cd dashboard
npm install
```

2. Build the dashboard:
```bash
npm run build
```

3. The built files will be in `dashboard/dist` directory.

## Development

Run the development server:

```bash
cd dashboard
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## Configuration

The dashboard automatically connects to the Nexus backend running on the same origin. No additional configuration is needed.

## Default Credentials

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the default password in production!

## API Endpoints

The dashboard communicates with the following backend API endpoints:

- `POST /api/auth/login` - User authentication
- `GET /api/auth/verify` - Token verification
- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get specific agent
- `GET /api/agents/:id/processes` - Get agent processes
- `POST /api/agents/:id/processes/:pid/kill` - Kill a process
- `POST /api/agents/:id/execute` - Execute command on agent
- `GET /api/commands/history` - Get command history
- `GET /api/logs` - Get system logs
- `DELETE /api/logs` - Clear logs

## WebSocket Events

### From Server to Client

- `agents:update` - List of all agents updated
- `agent:metrics` - Individual agent metrics updated
- `agent:status` - Agent online/offline status changed
- `command:output` - Command execution output
- `log:new` - New log entry

### From Client to Server

- `command:execute` - Execute command on agent
- `request:processes` - Request process list from agent

## Styling

The UI uses a custom color scheme:

- **Primary**: `#0d8bf2` (Bright Blue)
- **Background Dark**: `#101a22` (Very Dark Blue)
- **Background Light**: `#f5f7f8` (Light Gray - for contrast)

Custom CSS animations include:
- Glow effects on active elements
- CPU usage circular progress indicators
- Smooth transitions and hover effects

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - Part of the Nexus Project by Dronzer Studios
