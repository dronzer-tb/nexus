# Nexus Dashboard - Next.js Version

Modern Next.js 15 dashboard with NextAuth authentication for the Nexus monitoring platform.

## 🚀 Features

- **Next.js 15** with App Router
- **NextAuth v5** for authentication
- **Credentials Provider** (connects to Express backend)
- **Real-time Updates** via Socket.IO
- **API Proxy** layer for backend communication
- **TailwindCSS** with custom brutal theme
- **Protected Routes** with middleware
- **2FA Support** (TOTP + Recovery codes)
- **Force Password Change** flow
- **Password Reset** functionality

## 📦 Installation

```bash
# From the root nexus directory
npm run install:nextjs

# Or directly in this directory
npm install
```

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-this-in-production-min-32-chars

# Backend API URL
BACKEND_URL=http://localhost:8080

# Optional: Enable debug mode
# NEXTAUTH_DEBUG=true
```

### Generate NextAuth Secret

```bash
openssl rand -base64 32
```

## 🏃 Development

```bash
# Start Next.js dev server (from root)
npm run dev:nextjs

# Or from this directory
npm run dev
```

The dashboard will be available at: http://localhost:3000

**Important:** The Express backend must be running on port 8080 for authentication and API calls to work.

## 🏗️ Production Build

```bash
# Build (from root)
npm run build:nextjs

# Or from this directory
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
dashboard-nextjs/
├── app/
│   ├── (auth)/
│   │   └── login/              # Login page
│   ├── (dashboard)/
│   │   ├── layout.jsx          # Protected dashboard layout
│   │   ├── page.jsx            # Overview/home page
│   │   ├── settings/           # Settings pages
│   │   ├── logs/               # Logs page
│   │   └── ...                 # Other pages
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/  # NextAuth API routes
│   │   └── proxy/
│   │       └── [...path]/      # Proxy to Express backend
│   ├── layout.jsx              # Root layout
│   ├── providers.jsx           # NextAuth provider
│   └── globals.css             # Global styles
├── components/                 # React components
├── lib/
│   ├── auth.js                 # NextAuth configuration
│   ├── axios.js                # Axios instance
│   └── socket.js               # Socket.IO client
├── middleware.js               # Route protection
└── next.config.js              # Next.js config
```

## 🔐 Authentication Flow

1. **Login:** User submits credentials via NextAuth
2. **Backend Validation:** NextAuth calls Express `/api/auth/login`
3. **Token Storage:** Express JWT stored in NextAuth session
4. **API Requests:** Next.js proxy adds token to backend requests
5. **WebSocket:** Socket.IO connects using session token

## 🔄 API Proxy

All API calls go through Next.js API routes:

```
Client → /api/proxy/* → Express Backend (:8080/api/*)
```

Example:
```javascript
// Client makes request to Next.js
axios.get('/api/proxy/nodes')

// Next.js proxies to Express with session token
fetch('http://localhost:8080/api/nodes', {
  headers: { Authorization: 'Bearer <token>' }
})
```

## 🎨 Theming

Custom brutal/cyberpunk theme with:
- Neon colors (pink, cyan, purple, yellow)
- Custom scrollbars
- Glow effects
- Status indicators
- Brutal shadows

## 🐛 Troubleshooting

### Login Issues

1. Ensure Express backend is running on port 8080
2. Check `.env.local` has correct `BACKEND_URL`
3. Verify `NEXTAUTH_SECRET` is set
4. Check browser console for errors

### WebSocket Issues

1. Ensure WebSocket proxy is configured in `next.config.js`
2. Check Socket.IO connection in browser dev tools
3. Verify backend token is valid

### Build Errors

1. Clear Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check for TypeScript errors (if using TS)

## 📝 Migration from Old Dashboard

This dashboard replaces the Vite-based React dashboard. Key differences:

| Feature | Old (Vite) | New (Next.js) |
|---------|-----------|---------------|
| Framework | React + Vite | Next.js 15 |
| Routing | React Router | App Router |
| Auth | Custom Context | NextAuth |
| API Calls | Direct to Express | Via Next.js proxy |
| State | React Context | NextAuth Session |

## 🔗 Related Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [TailwindCSS](https://tailwindcss.com/docs)

## 📄 License

MIT - Dronzer Studios
