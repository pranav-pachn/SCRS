# Google OAuth Setup Guide for SCRS

## Overview
This guide explains how to configure Google OAuth authentication for the Smart Complaint Resolution System, enabling users to login with their Google accounts.

## Features Implemented
✅ **Hybrid Authentication**: Users can choose between:
- Traditional email/password login
- Google OAuth login ("Continue with Google")

✅ **Automatic Account Creation**: New users signing in with Google are automatically registered as citizens

✅ **Secure Token Exchange**: Uses Google's official OAuth2 client library for token verification

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `SCRS Authentication`
4. Click "Create"

### Step 2: Enable Google+ API

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (for public access)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Smart Complaint Resolution System
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click "Save and Continue"
6. Skip "Scopes" (click "Save and Continue")
7. Add test users if in testing mode
8. Click "Save and Continue"

### Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: SCRS Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:5500` (or your frontend port)
     - `http://127.0.0.1:5500`
   - **Authorized redirect URIs**:
     - `http://localhost:5500/login.html`
5. Click "Create"
6. **Important**: Copy your Client ID (format: `xxxxx.apps.googleusercontent.com`)

### Step 5: Configure Environment Variables

1. Open `backend/.env` file
2. Add/Update the Google Client ID:
   ```env
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   ```

### Step 6: Update Frontend Configuration

1. Open `frontend/login.html`
2. Find the line with `client_id: 'YOUR_GOOGLE_CLIENT_ID'`
3. Replace it with your actual Client ID:
   ```javascript
   google.accounts.id.initialize({
     client_id: 'your-actual-client-id.apps.googleusercontent.com',
     callback: handleGoogleCallback
   });
   ```

### Step 7: Test the Implementation

1. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```

2. Open `frontend/login.html` in your browser

3. Test both login methods:
   - Click "Continue with Google" → Complete Google sign-in
   - Use traditional email/password form

## How It Works

### Frontend Flow
1. User clicks "Continue with Google" button
2. Google Sign-In popup appears
3. User selects/authorizes Google account
4. Google returns a credential token
5. Frontend sends token to backend `/auth/google` endpoint
6. Backend validates token and returns JWT
7. User is logged in and redirected to dashboard

### Backend Flow
1. Receives Google credential token
2. Uses `google-auth-library` to verify token with Google
3. Extracts user info (email, name, Google ID)
4. Checks if user exists in database
5. If new user: Creates account with role 'citizen'
6. If existing user: Retrieves user data
7. Generates JWT token
8. Returns token and user info to frontend

## Database Schema

Users authenticated via Google OAuth are stored with:
```sql
email: normalized email from Google
name: full name from Google
role: 'citizen' (default for new users)
password_hash: 'GOOGLE_OAUTH' (placeholder, not used)
```

## Security Considerations

✅ **Token Verification**: All Google tokens are verified server-side using official library
✅ **Client ID Validation**: Tokens must match configured Client ID
✅ **Email Normalization**: Emails are normalized to lowercase for consistency
✅ **JWT Protection**: After OAuth, standard JWT authentication is used
✅ **No Password Storage**: OAuth users don't have real passwords stored

## Troubleshooting

### Issue: "Google login failed"
- **Check**: Client ID is correctly configured in both frontend and backend
- **Check**: Google Cloud project has OAuth consent screen configured
- **Check**: Your domain/localhost is added to authorized origins

### Issue: "Popup blocked"
- **Solution**: Enable popups for your localhost domain
- **Alternative**: Use redirect flow instead of popup (requires additional config)

### Issue: "Invalid audience"
- **Check**: GOOGLE_CLIENT_ID in .env matches the one from Google Cloud Console
- **Check**: No extra spaces or quotes in the Client IDIssue: User can't login after signing up with Google
- **Solution**: This is expected - Google OAuth users can only login via Google
- **Note**: Password login won't work for OAuth-created accounts

## Testing Checklist

- [ ] Google login creates new user account
- [ ] Google login works for existing users
- [ ] Traditional login still works independently
- [ ] JWT tokens are generated correctly for both methods
- [ ] User role is set correctly (citizen for new OAuth users)
- [ ] Navigation/logout works after OAuth login
- [ ] Multiple Google accounts can be used

## Production Deployment

When deploying to production:

1. Update authorized origins in Google Cloud Console:
   ```
   https://yourdomain.com
   ```

2. Update authorized redirect URIs:
   ```
   https://yourdomain.com/login.html
   ```

3. Update frontend client_id to use production Client ID

4. Consider using separate Google Cloud projects for dev/staging/production

5. Review OAuth consent screen for public release

## Support

For issues or questions:
- Review Google's [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- Check [Google Sign-In JavaScript Guide](https://developers.google.com/identity/gsi/web/guides/overview)
- Verify all configuration steps were completed

## Benefits of Hybrid Login

**For Users:**
- Faster login (no password to remember)
- Secure (Google handles authentication)
- Choice between Google or traditional login

**For System:**
- Reduced password management burden
- Better security (Google's authentication infrastructure)
- Lower friction for new user signup
- Fallback option if Google is unavailable

---

**Setup Complete!** Users can now login using either Google OAuth or traditional credentials.
