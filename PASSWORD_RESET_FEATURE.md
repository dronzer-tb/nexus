# Password Reset Feature - Documentation

**Added to Nexus v1.9.0**  
**Feature:** Forgot Password / Email-Based Password Reset

---

## 🎯 **Overview**

Complete password reset functionality allowing users to recover their accounts via email when they forget their password.

---

## ✅ **Features Implemented**

### 1. **Email Service Configuration**
- ✅ SMTP configuration in Settings → Security → Email Config
- ✅ Support for Gmail, Outlook, custom SMTP servers
- ✅ Secure credential storage
- ✅ Test email functionality
- ✅ Enable/disable toggle

### 2. **Password Reset Flow**
- ✅ "Forgot password?" link on login page
- ✅ Email input form
- ✅ Secure token generation (32-byte random hex)
- ✅ 1-hour token expiration
- ✅ Email with reset link
- ✅ Token verification
- ✅ New password form with confirmation
- ✅ Success/error handling

### 3. **Security Measures**
- ✅ Email enumeration prevention (always success response)
- ✅ Secure token storage (SHA-256 hashed)
- ✅ Time-based token expiration
- ✅ Token invalidation after use
- ✅ Password strength requirement (8+ characters)
- ✅ HTTPS recommended for production

---

## 📁 **Files Created**

### Backend:
- `src/utils/email.js` - Email service with nodemailer
- `src/api/routes/password-reset.js` - Password reset API endpoints
- `src/api/routes/email.js` - Email configuration API

### Frontend:
- `dashboard/src/pages/ResetPassword.jsx` - Password reset page
- `dashboard/src/components/EmailSettings.jsx` - Email config UI
- Updated `dashboard/src/pages/Login.jsx` - Forgot password form
- Updated `dashboard/src/App.jsx` - Reset password route

### Database:
- Added `email` column to users table
- Added `reset_token` column to users table
- Added `reset_token_expires` column to users table
- Automatic migration on startup

---

## 🔧 **API Endpoints**

### Password Reset:
```
POST   /api/password-reset/request    - Request password reset (send email)
GET    /api/password-reset/verify/:token - Verify reset token
POST   /api/password-reset/reset      - Reset password with token
```

### Email Configuration:
```
GET    /api/email/config              - Get email config (requires auth)
POST   /api/email/config              - Update email config (requires auth)
POST   /api/email/test                - Send test email (requires auth)
```

---

## 📧 **Email Configuration**

### Supported SMTP Providers:

#### **Gmail:**
1. Enable 2-Step Verification
2. Go to myaccount.google.com/apppasswords
3. Generate App Password
4. Use App Password in SMTP settings

**Settings:**
- SMTP Host: `smtp.gmail.com`
- SMTP Port: `587` (TLS) or `465` (SSL)
- SMTP User: your Gmail address
- SMTP Pass: App Password (16 characters)

#### **Outlook/Office 365:**
**Settings:**
- SMTP Host: `smtp-mail.outlook.com`
- SMTP Port: `587`
- SMTP User: your Outlook email
- SMTP Pass: your Outlook password

#### **Custom SMTP:**
Configure with your provider's settings

---

## 🚀 **Setup Guide**

### Step 1: Configure Email Service
1. Login to Nexus
2. Go to **Settings → Security → Email Config**
3. Enable email service
4. Enter SMTP details:
   - SMTP Host (e.g., smtp.gmail.com)
   - SMTP Port (587 for TLS)
   - SMTP Username (your email)
   - SMTP Password (app password)
   - From Email (sender address)
   - From Name (e.g., "Nexus Monitor")
5. Click "Save Configuration"
6. Test configuration:
   - Enter test email address
   - Click "Send Test"
   - Check inbox for test email

### Step 2: Add User Emails
1. Go to **Settings → Security → Users**
2. For each user, ensure email is set
3. Users need email addresses to use password reset

### Step 3: Test Password Reset
1. Logout
2. Click "Forgot password?" on login page
3. Enter your email address
4. Check email for reset link
5. Click link (or paste in browser)
6. Enter new password twice
7. Click "Reset Password"
8. Login with new password

---

## 🔒 **Security Features**

### Email Enumeration Prevention:
- Always returns success message
- Never reveals if email exists in system
- Prevents user discovery attacks

### Token Security:
- 32-byte random hex tokens (256-bit entropy)
- Stored hashed in database
- 1-hour expiration
- Single-use (invalidated after reset)
- Cannot be reused

### Password Requirements:
- Minimum 8 characters
- Validated on both client and server
- Bcrypt hashing (10 salt rounds)

### SMTP Security:
- Credentials stored in database
- Support for TLS/SSL encryption
- App passwords recommended
- Password never shown in API responses

---

## 📊 **Database Schema**

### Users Table (Extended):
```sql
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN reset_token TEXT;
ALTER TABLE users ADD COLUMN reset_token_expires INTEGER;
```

### Settings Table:
```sql
-- Email config stored in settings
INSERT INTO settings (key, value) VALUES ('email_config', '{...}');
```

---

## 🎨 **User Interface**

### Login Page - Forgot Password:
- "Forgot password?" link
- Email input form
- Success/error messages
- "Back" button to return to login

### Reset Password Page:
- Token verification (loading state)
- Invalid token error page
- Password reset form:
  - New password input
  - Confirm password input
  - Real-time password match indicator
  - Submit button
- Success page with auto-redirect

### Email Settings:
- Enable/disable toggle
- SMTP configuration form
- Test email functionality
- Security warnings
- Save button

---

## 📧 **Email Templates**

### Password Reset Email:
- Professional HTML template
- Gradient header design
- Reset button (call-to-action)
- Plain text link as backup
- Security warnings:
  - 1-hour expiration notice
  - Ignore if not requested
  - Never share link
- Security recommendations
- Branded footer

### Test Email:
- Confirmation of successful config
- SMTP details summary
- List of available features
- Professional design

---

## ⚠️ **Important Notes**

### For Administrators:
1. **Configure email BEFORE users need it**
2. **Test thoroughly** with multiple providers
3. **Use App Passwords** for Gmail (not account password)
4. **Enable 2FA** on email account
5. **Monitor email logs** for delivery issues
6. **Keep SMTP credentials secure**
7. **Use HTTPS** in production

### For Users:
1. **Keep email address updated**
2. **Check spam folder** if reset email doesn't arrive
3. **Reset links expire in 1 hour**
4. **Contact admin** if email not configured
5. **Choose strong passwords** (8+ characters)

### Troubleshooting:
- **Email not arriving:** Check spam, verify SMTP config
- **"Email not configured" error:** Admin needs to setup SMTP
- **"Invalid token" error:** Link expired or already used
- **SMTP errors:** Check host, port, credentials
- **Gmail errors:** Use App Password, not account password

---

## 🔄 **Password Reset Flow Diagram**

```
User Forgot Password
         ↓
Enter Email Address
         ↓
POST /api/password-reset/request
         ↓
Generate Random Token (32 bytes)
         ↓
Save Token + Expiry to Database
         ↓
Send Email with Reset Link
         ↓
User Clicks Link in Email
         ↓
GET /api/password-reset/verify/:token
         ↓
Verify Token Valid & Not Expired
         ↓
Show Password Reset Form
         ↓
User Enters New Password
         ↓
POST /api/password-reset/reset
         ↓
Validate Token & Password
         ↓
Hash Password (bcrypt)
         ↓
Update User Password
         ↓
Clear Token from Database
         ↓
Success → Redirect to Login
```

---

## 🧪 **Testing Checklist**

- [ ] Email configuration saves correctly
- [ ] Test email sends successfully
- [ ] Forgot password link appears on login
- [ ] Email request returns success (valid email)
- [ ] Email request returns success (invalid email)
- [ ] Reset email arrives in inbox
- [ ] Reset link opens correct page
- [ ] Invalid token shows error
- [ ] Expired token shows error
- [ ] Password mismatch shows error
- [ ] Short password shows error
- [ ] Valid reset changes password
- [ ] Old password no longer works
- [ ] New password works for login
- [ ] Token invalidated after use
- [ ] Cannot reuse reset link

---

## 📦 **Dependencies Added**

```json
{
  "nodemailer": "^6.9.x"
}
```

---

## 🔮 **Future Enhancements**

Potential improvements for future versions:
- SMS-based password reset
- Multiple email templates
- Custom email branding
- Email verification on signup
- Password reset audit log
- Rate limiting on reset requests
- Multi-language email templates
- OAuth email providers

---

## 📞 **Support**

**Common Issues:**

**Q: Reset email not arriving**  
A: Check spam folder, verify SMTP configuration, test email service

**Q: "Email service not configured" error**  
A: Admin needs to configure SMTP in Settings → Security → Email Config

**Q: Gmail authentication failed**  
A: Use App Password, not account password. Enable 2FA first.

**Q: Link expired**  
A: Reset links are valid for 1 hour. Request a new reset link.

**Q: Token already used**  
A: Each reset link can only be used once. Request a new link.

---

**Made with ❤️ by Dronzer Studios**

**Security Level:** 🔒 Production Ready  
**Email Support:** ✅ SMTP Compatible  
**User Friendly:** ✅ Simple 3-Step Process
