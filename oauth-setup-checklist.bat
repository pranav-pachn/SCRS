@echo off
REM ============================================================================
REM Google OAuth Configuration Checklist
REM Quick reference for setting up Google authentication in SCRS
REM ============================================================================

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  Google OAuth Configuration Checklist for SCRS              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo 📋 Configuration Steps:
echo.

echo 1️⃣  GOOGLE CLOUD CONSOLE SETUP
echo [ ] Go to https://console.cloud.google.com/
echo [ ] Create new project 'SCRS Authentication'
echo [ ] Enable Google+ API
echo [ ] Configure OAuth consent screen (External)
echo [ ] Create OAuth 2.0 Client ID (Web application)
echo [ ] Add authorized origin: http://localhost:5500
echo [ ] Copy Client ID (xxx.apps.googleusercontent.com)
echo.

echo 2️⃣  BACKEND CONFIGURATION
echo [ ] Open: backend\.env
echo [ ] Add: GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
echo [ ] Save file
echo [ ] Verify google-auth-library is installed (npm install)
echo.

echo 3️⃣  FRONTEND CONFIGURATION
echo [ ] Open: frontend\login.html
echo [ ] Find line ~144: client_id: 'YOUR_GOOGLE_CLIENT_ID'
echo [ ] Replace with your actual Client ID
echo [ ] Open: frontend\register.html
echo [ ] Find line ~150: client_id: 'YOUR_GOOGLE_CLIENT_ID'
echo [ ] Replace with your actual Client ID
echo [ ] Save both files
echo.

echo 4️⃣  TESTING
echo [ ] Start backend: cd backend ^&^& node server.js
echo [ ] Open frontend: frontend\login.html in browser
echo [ ] Test: Click 'Continue with Google'
echo [ ] Test: Sign in with Google account
echo [ ] Verify: User created and logged in
echo [ ] Test: Traditional email/password still works
echo.

echo 5️⃣  VERIFICATION
echo [ ] New user can sign up with Google
echo [ ] Existing user can login with Google
echo [ ] Traditional login still works
echo [ ] JWT token generated correctly
echo [ ] User redirected to dashboard after login
echo [ ] Logout functionality works
echo.

echo.
echo 📚 Documentation References:
echo    • Full Setup: docs\GOOGLE_OAUTH_SETUP.md
echo    • Quick Start: GOOGLE_OAUTH_QUICKSTART.md
echo    • Implementation: docs\HYBRID_AUTH_IMPLEMENTATION.md
echo.

echo 🔧 Configuration Files:
echo    • Backend: backend\.env
echo    • Frontend: frontend\login.html (line 144)
echo    • Frontend: frontend\register.html (line 150)
echo.

echo ❓ Troubleshooting:
echo    • 'Google login failed' → Check Client ID in .env and frontend
echo    • 'Invalid audience' → Verify Client ID matches Google Console
echo    • Button doesn't appear → Check browser console for errors
echo    • Popup blocked → Enable popups for localhost
echo.

echo ✅ Once configured, users can:
echo    ✓ Login with Google (fast, secure)
echo    ✓ Login with email/password (traditional)
echo    ✓ Sign up with Google (one-click)
echo    ✓ Sign up with email/password (full control)
echo.

echo ╔══════════════════════════════════════════════════════════════╗
echo ║  Ready to configure? Follow the checklist above! 🚀         ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
