# Nexus Development Guide

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ 
- npm 8+
- Git
- Code editor (VS Code recommended)

### Initial Setup

1. **Clone and Install**
```bash
git clone https://github.com/dronzer-tb/nexus.git
cd nexus
npm install
cd dashboard && npm install && cd ..
```

2. **Configure for Development**
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

3. **Build Dashboard**
```bash
npm run build:dashboard
```

### Development Workflow

#### Backend Development

```bash
# Start with auto-reload (combine mode)
npm run dev

# Or start specific mode
node src/index.js --mode=server
node src/index.js --mode=node
```

#### Frontend Development

```bash
# Terminal 1: Start backend
npm run start:server

# Terminal 2: Start frontend dev server with hot reload
cd dashboard
npm run dev
```

The frontend dev server runs on `http://localhost:3000` and proxies API calls to `http://localhost:8080`.

### Project Structure Explained

```
src/
├── index.js              # Entry point, mode selection, banner
├── modes/                # Operating mode implementations
│   ├── node.js          # Collects metrics, sends to server
│   ├── server.js        # Hosts API and dashboard
│   └── combine.js       # Runs both node and server
├── api/                  # API layer
│   ├── routes/          # Express route handlers
│   └── websocket.js     # Socket.IO event handlers
└── utils/               # Shared utilities
    ├── auth.js          # Authentication logic
    ├── config.js        # Config file management
    ├── database.js      # SQLite operations
    ├── logger.js        # Winston logger setup
    └── metrics.js       # System metrics collection

dashboard/src/
├── main.jsx             # React entry point
├── App.jsx              # Main app component
├── index.css            # Tailwind styles
└── components/          # React components
    ├── Header.jsx       # Top navigation
    ├── Stats.jsx        # Summary statistics
    ├── NodesList.jsx    # Node list sidebar
    ├── NodeDetails.jsx  # Main detail view
    ├── MetricsChart.jsx # Chart.js wrapper
    ├── SystemInfo.jsx   # System specs display
    └── ProcessList.jsx  # Process table
```

## 🧪 Testing

### Manual Testing

1. **Test Combine Mode**
```bash
npm run start:combine
# Open http://localhost:8080
# Verify metrics are updating
```

2. **Test Server + Node Separately**
```bash
# Terminal 1
npm run start:server

# Terminal 2
npm run start:node

# Check dashboard shows the node
```

3. **Test API Endpoints**
```bash
# Health check
curl http://localhost:8080/health

# Get nodes
curl http://localhost:8080/api/nodes

# Get metrics (requires node ID)
curl http://localhost:8080/api/metrics/<node-id>/latest
```

### WebSocket Testing

Use the browser console:
```javascript
const socket = io();
socket.on('nodes:update', (nodes) => console.log('Nodes:', nodes));
socket.on('metrics:new', (data) => console.log('New metrics:', data));
```

## 🐛 Debugging

### Backend Debugging

1. **Enable Debug Logging**
Edit `config/config.json`:
```json
{
  "logging": {
    "level": "debug"
  }
}
```

2. **View Logs**
```bash
tail -f data/nexus.log
```

3. **VS Code Debugging**
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Combine Mode",
      "program": "${workspaceFolder}/src/index.js",
      "args": ["--mode=combine"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Frontend Debugging

- Use React DevTools browser extension
- Check browser console for errors
- Use Network tab to monitor WebSocket connections
- Check Redux DevTools if state management added

### Common Issues

**Dashboard not loading**
```bash
# Rebuild dashboard
cd dashboard && npm run build && cd ..
```

**Node can't connect to server**
```bash
# Check config/config.json
# Ensure serverUrl is correct
# Check server is running
```

**Database locked errors**
```bash
# Close all connections
# Delete data/nexus.db (WARNING: loses data)
# Restart application
```

## 📦 Building

### Development Build
```bash
npm run build:dashboard
```

### Production Build
```bash
# Backend is not compiled (Node.js runs it directly)
# Only frontend needs building
cd dashboard
npm run build
cd ..
```

### Docker Build
```bash
docker build -t dronzer/nexus:dev .
```

## 🚀 Adding New Features

### Adding a New Metric

1. **Update metrics collector** (`src/utils/metrics.js`)
```javascript
async getNewMetric() {
  // Collect new metric
  return data;
}

async getAllMetrics() {
  const newMetric = await this.getNewMetric();
  return {
    ...existingMetrics,
    newMetric
  };
}
```

2. **Update database schema** (`src/utils/database.js`)
```javascript
// Add new column to metrics table
this.db.exec(`
  ALTER TABLE metrics ADD COLUMN new_metric TEXT;
`);
```

3. **Display in dashboard** (`dashboard/src/components/`)
Create new component or update existing ones

### Adding a New API Endpoint

1. **Create route** (`src/api/routes/`)
```javascript
router.get('/new-endpoint', (req, res) => {
  // Handler logic
});
```

2. **Register route** (`src/modes/server.js`)
```javascript
const newRouter = require('../api/routes/new-route');
this.app.use('/api/new', newRouter);
```

### Adding WebSocket Event

1. **Add handler** (`src/api/websocket.js`)
```javascript
socket.on('new:event', (data) => {
  // Handle event
});
```

2. **Use in frontend** (`dashboard/src/`)
```javascript
socket.emit('new:event', data);
socket.on('new:response', (response) => {
  // Handle response
});
```

## 🎨 Styling

### Tailwind CSS

The project uses Tailwind with custom theme:

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      dark: '#0f172a',
      'dark-lighter': '#1e293b',
      'dark-lightest': '#334155',
    }
  }
}
```

### Custom CSS

Add to `dashboard/src/index.css`:
```css
@layer components {
  .custom-class {
    @apply bg-dark-lighter p-4 rounded;
  }
}
```

## 📊 Performance Optimization

### Backend
- Metrics collection is throttled to 5-second intervals
- Database uses WAL mode for better concurrency
- Old metrics can be cleaned up with `cleanOldMetrics()`

### Frontend
- React memoization with `useMemo` and `useCallback`
- Chart data limited to last 100 points
- WebSocket subscriptions cleanup on unmount

### Database
```javascript
// Clean old metrics periodically
setInterval(() => {
  database.cleanOldMetrics(7); // Keep 7 days
}, 24 * 60 * 60 * 1000); // Daily
```

## 🔒 Security Best Practices

1. **Never commit secrets**
   - Use .env files
   - Keep .env in .gitignore

2. **API Key Management**
   - Rotate keys regularly
   - Store hashed in database
   - Never log full keys

3. **HTTPS in Production**
```json
{
  "security": {
    "enableHttps": true,
    "certPath": "/path/to/cert.pem",
    "keyPath": "/path/to/key.pem"
  }
}
```

4. **Rate Limiting** (TODO)
```javascript
// Add to server.js
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
```

## 📝 Code Style

### JavaScript/JSX
- Use ES6+ features
- Prefer const over let
- Use async/await over promises
- Add JSDoc comments for functions
- Use meaningful variable names

### React
- Functional components with hooks
- One component per file
- Props destructuring
- Early returns for conditions

### Example
```javascript
/**
 * Formats bytes to human readable string
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  // ...
}
```

## 🧩 Dependencies

### Backend
- `express` - Web framework
- `socket.io` - WebSocket library
- `systeminformation` - System metrics
- `better-sqlite3` - SQLite database
- `winston` - Logging
- `jsonwebtoken` - JWT auth

### Frontend
- `react` - UI framework
- `chart.js` - Charts
- `react-chartjs-2` - React wrapper for Chart.js
- `socket.io-client` - WebSocket client
- `tailwindcss` - CSS framework
- `date-fns` - Date formatting

## 📚 Resources

- [Express Documentation](https://expressjs.com/)
- [Socket.IO Docs](https://socket.io/docs/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Chart.js](https://www.chartjs.org/)
- [systeminformation](https://github.com/sebhildebrandt/systeminformation)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Submit pull request

### Commit Message Format
```
type(scope): subject

body

footer
```

Types: feat, fix, docs, style, refactor, test, chore

Example:
```
feat(metrics): add GPU usage monitoring

- Added GPU metrics collection
- Updated dashboard to display GPU stats
- Added tests for GPU metrics

Closes #123
```

## 🎯 Roadmap Ideas

- [ ] User authentication for dashboard
- [ ] Email/SMS alerts for threshold breaches
- [ ] Historical data export (CSV, JSON)
- [ ] Custom metric plugins
- [ ] Multi-tenancy support
- [ ] Advanced process management (kill, restart)
- [ ] Docker container monitoring
- [ ] Network topology visualization
- [ ] Mobile app

---

Happy coding! 🚀

*Dronzer Studios*
