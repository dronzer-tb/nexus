# Authentik Manual Setup Guide for Nexus

Since the API bootstrap token expires, follow these manual steps to configure Nexus in Authentik:

## Step 1: Access Authentik Admin Console

1. Open browser: http://localhost:9090/if/admin/
2. Login with credentials from: `~/.authentik-data/admin-credentials.txt`
   - Username: `akadmin`
   - Password: (see credentials file)

## Step 2: Create OAuth2/OIDC Provider

1. Navigate to **Applications → Providers**
2. Click **Create**
3. Select **OAuth2/OpenID Provider**
4. Configure:
   - **Name**: `nexus-oauth`
   - **Authorization flow**: `default-provider-authorization-implicit-consent`
   - **Client type**: `Confidential`
   - **Client ID**: `nexus` (or generate random)
   - **Client Secret**: (copy this - you'll need it!)
   - **Redirect URIs**: 
     ```
     http://localhost:8080/api/auth/callback
     http://localhost:8080/*
     ```
5. Click **Finish**

## Step 3: Create Application

1. Navigate to **Applications → Applications**
2. Click **Create**
3. Configure:
   - **Name**: `Nexus Monitoring`
   - **Slug**: `nexus`
   - **Provider**: Select the provider you just created
   - **Launch URL**: `http://localhost:8080`
4. Click **Create**

## Step 4: Create Groups (Optional but Recommended)

1. Navigate to **Directory → Groups**
2. Create three groups:
   - `nexus-admins` (for admin users)
   - `nexus-operators` (for operators)
   - `nexus-viewers` (for read-only users)

## Step 5: Create Test User

1. Navigate to **Directory → Users**
2. Click **Create**
3. Configure:
   - **Username**: `testuser`
   - **Email**: `testuser@nexus.local`
   - **Password**: Set a password
4. Click **Create**
5. Add user to `nexus-admins` group

## Step 6: Configure Nexus Environment

Update your `.env` file:

```bash
# Authentik Authentication
AUTHENTIK_ENABLED=true
AUTHENTIK_URL=http://localhost:9090
AUTHENTIK_CLIENT_ID=<your-client-id-from-step-2>
AUTHENTIK_CLIENT_SECRET=<your-client-secret-from-step-2>
AUTHENTIK_REDIRECT_URI=http://localhost:8080/api/auth/callback
```

## Step 7: Restart Nexus

```bash
npm start
```

## Step 8: Test Login

1. Open: http://localhost:8080
2. You should see "Login with Authentik" button
3. Click it to test OAuth flow
4. Login with your test user credentials
5. You should be redirected back to Nexus dashboard

## Troubleshooting

**"Login with Authentik" button not showing:**
- Check that `AUTHENTIK_ENABLED=true` in .env
- Restart Nexus
- Check browser console for errors

**OAuth redirect fails:**
- Verify redirect URI matches exactly in Authentik provider
- Check that Authentik is accessible at the URL in .env

**Token validation fails:**
- Verify client ID and secret match
- Check Nexus logs: `journalctl -u nexus -f` (if using systemd)
- Check Authentik logs: `cd ~/.authentik && docker compose logs -f server`

**User has no permissions:**
- Assign user to appropriate group (nexus-admins, nexus-operators, nexus-viewers)
- Default role is 'viewer' if no group assigned

