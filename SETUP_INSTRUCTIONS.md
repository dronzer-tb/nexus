# 🚀 Nexus Setup Instructions

## 📦 What's Included

This archive contains the complete Nexus monitoring platform with:
- **Express Backend** (Node.js server)
- **React Dashboard** (Old - Vite)
- **Next.js Dashboard** (New - with NextAuth)
- **Mobile App** (React Native)

---

## ⚡ Quick Setup (Next.js Dashboard)

### **Prerequisites**

- Node.js >= 18.0.0
- npm or yarn

### **Step 1: Extract & Install**

```bash
# Extract the zip file
unzip nexus-complete.zip
cd nexus

# Install backend dependencies
npm install

# Install Next.js dashboard dependencies
npm run install:nextjs
```

### **Step 2: Generate NextAuth Secret**

```bash
# Generate a secure secret
openssl rand -base64 32

# Copy the output
```

Edit `dashboard-nextjs/.env.local` and replace:
```env
NEXTAUTH_SECRET=your-secret-key-change-this-in-production-min-32-chars
```

With your generated secret:
```env
NEXTAUTH_SECRET=<paste-your-generated-secret-here>
```

### **Step 3: Setup Admin User**

The system will create a default admin on first run. You can also manually create one:

```bash
# Run setup to create admin user
node src/utils/setup-admin.js
```

Or use the database user I created:
- **Username**: `dronzer`
- **Password**: `Test123456`

### **Step 4: Start Services**

**Terminal 1 - Backend:**
```bash
cd nexus
npm run dev
# Or: npm start
```

**Terminal 2 - Next.js Dashboard:**
```bash
cd nexus
npm run dev:nextjs
```

### **Step 5: Access Dashboard**

Open browser: **http://localhost:3000**

Login with:
- Username: `dronzer` (or `admin`)
- Password: `Test123456` (or whatever you set)

---

## 🔧 Detailed Setup

### **Environment Configuration**

#### Backend (Optional)
Create `nexus/.env` if needed:
```env
PORT=8080
NODE_ENV=development
```

#### Next.js Dashboard
Already configured in `dashboard-nextjs/.env.local`:
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl>
BACKEND_URL=http://localhost:8080
```

### **Database Setup**

The SQLite database is auto-created on first run at:
- `nexus/data/nexus.db`

Admin credentials are stored in:
- `nexus/data/admin-credentials.json`

### **Build for Production**

```bash
# Build backend (if needed)
npm install --production

# Build Next.js dashboard
npm run build:nextjs

# Start production servers
# Terminal 1:
npm start

# Terminal 2:
cd dashboard-nextjs
npm run start
```

---

## 📁 Project Structure

```
nexus/
├── src/                      # Express backend
│   ├── api/routes/          # API endpoints
│   ├── modes/               # Node/Server/Combine modes
│   └── utils/               # Utilities
├── dashboard/               # OLD React + Vite dashboard
├── dashboard-nextjs/        # NEW Next.js 15 dashboard ✅
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   ├── lib/                 # Auth & utilities
│   └── .env.local           # Environment config
├── nexus-mobile/            # React Native mobile app
├── data/                    # Database & logs (auto-created)
└── config/                  # Configuration files
```

---

## 🎯 Testing the New Login Page

### **1. Test Basic Login**

1. Navigate to: http://localhost:3000
2. Should see Next.js login page with Nexus branding
3. Enter credentials:
   - Username: `dronzer`
   - Password: `Test123456`
4. Click "Login"
5. Should redirect to dashboard homepage

### **2. Test Password Reset**

1. On login page, click "Forgot Password?"
2. Enter username: `dronzer`
3. Click "Request Reset Code"
4. **Check Terminal 1** (backend) for 6-digit code in console
5. Enter the code
6. Enter new password (min 8 characters)
7. Should see success message
8. Login with new password

### **3. Test 2FA (If Enabled)**

1. Login with username/password
2. If 2FA is required, enter 6-digit TOTP code
3. Or use recovery code
4. Should authenticate and redirect to dashboard

### **4. Test Force Password Change**

If a user has `mustChangePassword: true`:
1. Login with credentials
2. Should see "Force Password Change" screen
3. Enter current password
4. Enter new password (min 8 chars)
5. Confirm new password
6. Click "Change Password & Continue"
7. Should redirect to dashboard

---

## 🐛 Troubleshooting

### **Issue: Cannot connect to backend**

**Solution:**
```bash
# Check if backend is running
curl http://localhost:8080/api/system/info

# If not working, restart backend
cd nexus
npm run dev
```

### **Issue: Next.js build fails**

**Solution:**
```bash
cd nexus/dashboard-nextjs
rm -rf .next node_modules
npm install
npm run build
```

### **Issue: Login fails with "Invalid credentials"**

**Solution:**
1. Check backend is running on port 8080
2. Verify username exists:
   ```bash
   sqlite3 data/nexus.db "SELECT username FROM users;"
   ```
3. Check `data/admin-credentials.json` for file-based admin
4. Reset password using password reset flow

### **Issue: "Module not found" errors**

**Solution:**
```bash
cd nexus/dashboard-nextjs
npm install
```

### **Issue: Socket.IO connection fails**

**Solution:**
1. Check backend WebSocket is running
2. Verify `next.config.js` has WebSocket proxy:
   ```javascript
   async rewrites() {
     return [
       {
         source: '/socket.io/:path*',
         destination: 'http://localhost:8080/socket.io/:path*',
       },
     ]
   }
   ```

---

## 📝 Default Ports

- **Backend**: http://localhost:8080
- **Next.js Dashboard**: http://localhost:3000
- **Old Vite Dashboard**: Port 3000 (if used)
- **WebSocket**: Same as backend (8080)

---

## 🔐 Security Notes

1. **Change default passwords** before production use
2. **Generate new NextAuth secret** with `openssl rand -base64 32`
3. **Set strong admin password** during setup
4. **Enable 2FA** for admin accounts
5. **Use HTTPS** in production (configure reverse proxy)

---

## 🚀 Production Deployment

### **Using PM2 (Recommended)**

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start src/index.js --name nexus-backend

# Start Next.js
cd dashboard-nextjs
pm2 start npm --name nexus-dashboard -- start

# Save PM2 config
pm2 save
pm2 startup
```

### **Using systemd**

See documentation in `README.md` for systemd service setup.

### **Using Docker**

Docker configuration coming soon.

---

## 📚 Documentation

- **NEXTJS_MIGRATION.md** - Full migration details
- **QUICK_START_NEXTJS.md** - 5-minute quick start
- **dashboard-nextjs/README.md** - Next.js dashboard docs
- **README.md** - Main project documentation

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Backend starts without errors
- [ ] Next.js dashboard starts without errors
- [ ] Can access http://localhost:3000
- [ ] Login page loads correctly
- [ ] Can login with credentials
- [ ] Dashboard displays after login
- [ ] WebSocket connects (check browser console)
- [ ] Real-time updates work
- [ ] Password reset works
- [ ] 2FA works (if enabled)

---

## 🆘 Need Help?

1. Check the **Troubleshooting** section above
2. Review backend logs in Terminal 1
3. Check browser console (F12) for errors
4. Review `data/nexus.log` for backend errors
5. Enable NextAuth debug: `NEXTAUTH_DEBUG=true` in `.env.local`

---

## 📞 Support

- **GitHub**: (Your repository URL)
- **Documentation**: See markdown files in root directory
- **Logs**: Check `data/nexus.log`

---

**Developed by Dronzer Studios**  
**Version**: Nexus v1.9.0 → v2.0.0 (Next.js)  
**Date**: February 2026
