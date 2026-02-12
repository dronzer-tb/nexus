# 🚀 Quick Start - Next.js Dashboard

## ⚡ 5-Minute Setup

### **Step 1: Install Dependencies**

```bash
cd nexus
npm run install:nextjs
```

### **Step 2: Configure Environment**

The `.env.local` file is already created. Just generate a secure secret:

```bash
# Generate NextAuth secret
openssl rand -base64 32

# Copy the output and update dashboard-nextjs/.env.local
# Replace: NEXTAUTH_SECRET=your-secret-key-change-this-in-production-min-32-chars
```

### **Step 3: Start Services**

Open **two terminals**:

**Terminal 1 - Backend:**
```bash
cd nexus
npm run dev
```

**Terminal 2 - Dashboard:**
```bash
cd nexus
npm run dev:nextjs
```

### **Step 4: Access Dashboard**

Open browser: **http://localhost:3000**

**Login Credentials:**
- Username: `dronzer`
- Password: `Test123456`

---

## 🎯 What You Get

✅ **Next.js 15** dashboard with App Router  
✅ **NextAuth** authentication  
✅ **Real-time** metrics via Socket.IO  
✅ **2FA** support  
✅ **Password reset** functionality  
✅ **Protected routes**  
✅ **Modern UI** with TailwindCSS  

---

## 📝 Common Tasks

### **Change Password**
1. Login to dashboard
2. Go to Settings
3. Change password section

### **Reset Forgotten Password**
1. Click "Forgot Password?" on login
2. Enter username
3. Check server console for 6-digit code
4. Enter code and new password

### **Enable 2FA**
1. Login to dashboard
2. Go to Settings → Two-Factor Authentication
3. Scan QR code with authenticator app
4. Enter verification code

---

## 🔍 Verify Installation

```bash
# Check Next.js build
cd nexus/dashboard-nextjs
npm run build

# Should see: ✓ Compiled successfully
```

---

## ❓ Troubleshooting

**Problem**: Cannot connect to backend  
**Solution**: Ensure Express backend is running on port 8080

**Problem**: Login fails  
**Solution**: Check backend logs and verify credentials

**Problem**: Build fails  
**Solution**: Run `npm install` in dashboard-nextjs folder

---

## 📚 Full Documentation

- **Migration Guide**: `NEXTJS_MIGRATION.md`
- **Dashboard README**: `dashboard-nextjs/README.md`
- **Main README**: `README.md`

---

**You're all set! 🎉**
