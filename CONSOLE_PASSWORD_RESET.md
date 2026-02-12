# Console-Based Password Reset - Nexus v1.9.0

**Feature:** Simple, No-Email Password Reset System

---

## 🎯 **Overview**

A simplified password reset system that displays a 6-digit code in the server console/logs instead of sending emails. This eliminates the need for SMTP configuration and makes password recovery accessible to administrators with console access.

---

## ✅ **Features**

### **Simple 3-Step Process:**
1. User enters username on login page
2. Administrator checks server console for 6-digit code
3. User enters code + new password

### **Security Features:**
- ✅ 6-digit random codes (000000-999999)
- ✅ 10-minute expiration
- ✅ Single-use codes
- ✅ Username enumeration prevention
- ✅ Password strength validation (8+ characters)
- ✅ Password confirmation required

---

## 🚀 **How It Works**

### **For Users:**

1. **Request Reset Code:**
   - Go to login page
   - Click "Forgot password?"
   - Enter your username
   - Click "Generate Reset Code"
   - Message appears: "Ask administrator to check server console"

2. **Get Code from Admin:**
   - Contact your system administrator
   - They will check the server console/logs
   - They will give you the 6-digit code

3. **Reset Password:**
   - Enter the 6-digit code
   - Enter your new password (min. 8 characters)
   - Confirm your new password
   - Click "Reset Password"
   - Success! Login with new password

---

### **For Administrators:**

1. **User Requests Reset:**
   - User will tell you they requested a password reset

2. **Check Server Console:**
   - Look at your server console/terminal
   - Or check logs: `sudo journalctl -u nexus -f`
   - You'll see a prominent box with the reset code:

```
================================================================================
╔════════════════════════════════════════════════════════════════════════════╗
║                    PASSWORD RESET CODE GENERATED                           ║
╚════════════════════════════════════════════════════════════════════════════╝

  Username:      admin
  Reset Code:     123456 
  Valid for:     10 minutes
  Requested at:  2/12/2026, 4:30:00 PM

  ⚠️  This code will expire in 10 minutes
  ⚠️  Code can only be used once

================================================================================
```

3. **Give Code to User:**
   - Securely communicate the 6-digit code to the user
   - User enters it on the reset form

---

## 🔧 **API Endpoints**

### **Request Reset Code:**
```
POST /api/password-reset/request
Body: { "username": "admin" }

Response:
{
  "success": true,
  "message": "If an account with that username exists, a reset code has been generated. Check the server console for the code."
}
```

### **Verify Code:**
```
POST /api/password-reset/verify
Body: { "username": "admin", "code": "123456" }

Response:
{
  "success": true,
  "username": "admin"
}
```

### **Reset Password:**
```
POST /api/password-reset/reset
Body: {
  "username": "admin",
  "code": "123456",
  "newPassword": "newSecurePassword123"
}

Response:
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

---

## 📁 **Files Modified**

### Backend:
- `src/api/routes/password-reset.js` - Console code generation
- `src/utils/database.js` - Reset token storage (uses existing columns)

### Frontend:
- `dashboard/src/pages/Login.jsx` - 2-step reset form
- Removed email-related components

### Dependencies:
- Added `chalk` for colorful console output

---

## 🎨 **Console Output Features**

The console output uses **chalk** for colored, prominent display:
- **Cyan border** - Easy to spot in logs
- **Green code** on black background - High visibility
- **Yellow labels** - Clear field identification
- **Red warnings** - Emphasizes expiration and single-use
- **80-character width** - Compatible with most terminals

---

## 🔒 **Security Considerations**

### **Strengths:**
- ✅ No email infrastructure required
- ✅ No SMTP credentials to manage
- ✅ Direct admin control over resets
- ✅ Clear audit trail in console logs
- ✅ Short expiration (10 minutes)
- ✅ Single-use codes

### **Considerations:**
- ⚠️ Requires admin access to server console/logs
- ⚠️ Admin must securely communicate code to user
- ⚠️ Code visible in logs (cleared after use)
- ⚠️ Not suitable for large user bases without admin access

### **Best Practices:**
1. **Communicate codes securely** (Signal, encrypted chat, in-person)
2. **Don't send codes via email/SMS** if possible
3. **Monitor logs** for unauthorized reset attempts
4. **Clear old logs** periodically
5. **Use HTTPS** to protect password transmission
6. **Consider enabling 2FA** for additional security

---

## 🛠️ **Troubleshooting**

### **Code not appearing in console:**
- Check that server is running
- Look at logs: `sudo journalctl -u nexus -f`
- Verify username is correct
- Check server terminal/output

### **"Invalid or expired reset code":**
- Code expires after 10 minutes
- Code can only be used once
- Request a new code
- Check for typos (codes are 6 digits)

### **"Invalid username or code":**
- Verify username is correct
- Request new code if expired
- Check that user account exists

### **Password requirements not met:**
- Minimum 8 characters
- Passwords must match
- Cannot be empty

---

## 📊 **Comparison: Console vs Email**

| Feature | Console-Based | Email-Based |
|---------|---------------|-------------|
| Setup Complexity | ✅ None | ❌ SMTP config required |
| Admin Dependency | ⚠️ Required | ✅ Self-service |
| Infrastructure | ✅ None needed | ❌ Email server required |
| Scalability | ⚠️ Low (manual) | ✅ High (automated) |
| Security | ✅ Admin-controlled | ⚠️ Email security risks |
| User Experience | ⚠️ Requires admin contact | ✅ Fully automated |
| Best For | Small teams, single admin | Large organizations |

---

## 💡 **Use Cases**

### **Perfect For:**
- ✅ Small teams (1-10 users)
- ✅ Single administrator setup
- ✅ Internal/private deployments
- ✅ No email infrastructure
- ✅ High security environments
- ✅ Development/testing setups

### **Not Ideal For:**
- ❌ Large user bases
- ❌ Self-service portals
- ❌ Distributed teams without admin access
- ❌ Public-facing applications
- ❌ 24/7 automated recovery needed

---

## 🔄 **Password Reset Flow**

```
┌─────────────┐
│ User clicks │
│ "Forgot     │
│ password?"  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Enter       │
│ username    │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│ API Request │─────▶│ Generate     │
│ to server   │      │ 6-digit code │
└─────────────┘      └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Display in   │
                     │ console with │
                     │ chalk colors │
                     └──────┬───────┘
                            │
       ┌────────────────────┘
       │
       ▼
┌─────────────┐
│ Admin sees  │
│ code in     │
│ console     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Admin gives │
│ code to     │
│ user        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ User enters │
│ code +      │
│ new pwd     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Password    │
│ reset       │
│ successful  │
└─────────────┘
```

---

## 🧪 **Testing**

### **Test Scenarios:**

1. **Successful Reset:**
   - Request code with valid username
   - Verify code appears in console
   - Enter code within 10 minutes
   - Set new password
   - Login with new password ✅

2. **Expired Code:**
   - Request code
   - Wait 11 minutes
   - Try to use code
   - Should show "expired" error ✅

3. **Invalid Code:**
   - Request code
   - Enter wrong 6-digit code
   - Should show "invalid" error ✅

4. **Username Enumeration:**
   - Request code with fake username
   - Should still show success message ✅
   - No code generated in console ✅

5. **Single-Use Code:**
   - Request code
   - Use code to reset password
   - Try to use same code again
   - Should fail ✅

6. **Password Validation:**
   - Try password < 8 characters → Error ✅
   - Try mismatched passwords → Error ✅
   - Use valid password → Success ✅

---

## 📝 **Example Console Output**

```bash
2026-02-12 16:30:15 [info]: Server mode started on http://0.0.0.0:8080

================================================================================
╔════════════════════════════════════════════════════════════════════════════╗
║                    PASSWORD RESET CODE GENERATED                           ║
╚════════════════════════════════════════════════════════════════════════════╝

  Username:      john.doe
  Reset Code:     847293 
  Valid for:     10 minutes
  Requested at:  2/12/2026, 4:30:25 PM

  ⚠️  This code will expire in 10 minutes
  ⚠️  Code can only be used once

================================================================================

2026-02-12 16:30:25 [info]: Password reset code generated for user: john.doe
```

---

## 🎯 **Quick Reference**

### **User Instructions:**
1. Click "Forgot password?"
2. Enter username
3. Ask admin for code from console
4. Enter code + new password
5. Login with new password

### **Admin Instructions:**
1. Check server console when notified
2. Find the boxed code output
3. Give 6-digit code to user
4. Code expires in 10 minutes

### **Log Viewing Commands:**
```bash
# Systemd service
sudo journalctl -u nexus -f

# Docker
docker logs -f nexus

# PM2
pm2 logs nexus

# Direct console
# Just look at terminal output
```

---

## 🔮 **Future Enhancements**

Potential improvements:
- Admin notification webhook
- Slack/Discord integration for code delivery
- Web-based admin panel to view codes
- Configurable expiration time
- Rate limiting on reset requests
- Admin approval workflow
- Multi-admin code retrieval

---

**Made with ❤️ by Dronzer Studios**

**Security Level:** 🔒 Admin-Controlled  
**Ease of Setup:** ✅ Zero Configuration  
**User Experience:** ⚠️ Requires Admin Contact
