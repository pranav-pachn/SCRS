#!/bin/bash

# ============================================================================
# Google OAuth Configuration Checklist
# Quick reference for setting up Google authentication in SCRS
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Google OAuth Configuration Checklist for SCRS              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Function to display checklist item
checklist_item() {
    echo "[ ] $1"
}

echo "📋 Configuration Steps:"
echo ""

echo "1️⃣  GOOGLE CLOUD CONSOLE SETUP"
checklist_item "Go to https://console.cloud.google.com/"
checklist_item "Create new project 'SCRS Authentication'"
checklist_item "Enable Google+ API"
checklist_item "Configure OAuth consent screen (External)"
checklist_item "Create OAuth 2.0 Client ID (Web application)"
checklist_item "Add authorized origin: http://localhost:5500"
checklist_item "Copy Client ID (xxx.apps.googleusercontent.com)"
echo ""

echo "2️⃣  BACKEND CONFIGURATION"
checklist_item "Open: backend/.env"
checklist_item "Add: GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com"
checklist_item "Save file"
checklist_item "Verify google-auth-library is installed (npm install)"
echo ""

echo "3️⃣  FRONTEND CONFIGURATION"
checklist_item "Open: frontend/login.html"
checklist_item "Find line ~144: client_id: 'YOUR_GOOGLE_CLIENT_ID'"
checklist_item "Replace with your actual Client ID"
checklist_item "Open: frontend/register.html"
checklist_item "Find line ~150: client_id: 'YOUR_GOOGLE_CLIENT_ID'"
checklist_item "Replace with your actual Client ID"
checklist_item "Save both files"
echo ""

echo "4️⃣  TESTING"
checklist_item "Start backend: cd backend && node server.js"
checklist_item "Open frontend: frontend/login.html in browser"
checklist_item "Test: Click 'Continue with Google'"
checklist_item "Test: Sign in with Google account"
checklist_item "Verify: User created and logged in"
checklist_item "Test: Traditional email/password still works"
echo ""

echo "5️⃣  VERIFICATION"
checklist_item "New user can sign up with Google"
checklist_item "Existing user can login with Google"
checklist_item "Traditional login still works"
checklist_item "JWT token generated correctly"
checklist_item "User redirected to dashboard after login"
checklist_item "Logout functionality works"
echo ""

echo ""
echo "📚 Documentation References:"
echo "   • Full Setup: docs/GOOGLE_OAUTH_SETUP.md"
echo "   • Quick Start: GOOGLE_OAUTH_QUICKSTART.md"
echo "   • Implementation: docs/HYBRID_AUTH_IMPLEMENTATION.md"
echo ""

echo "🔧 Configuration Files:"
echo "   • Backend: backend/.env"
echo "   • Frontend: frontend/login.html (line 144)"
echo "   • Frontend: frontend/register.html (line 150)"
echo ""

echo "❓ Troubleshooting:"
echo "   • 'Google login failed' → Check Client ID in .env and frontend"
echo "   • 'Invalid audience' → Verify Client ID matches Google Console"
echo "   • Button doesn't appear → Check browser console for errors"
echo "   • Popup blocked → Enable popups for localhost"
echo ""

echo "✅ Once configured, users can:"
echo "   ✓ Login with Google (fast, secure)"
echo "   ✓ Login with email/password (traditional)"
echo "   ✓ Sign up with Google (one-click)"
echo "   ✓ Sign up with email/password (full control)"
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Ready to configure? Follow the checklist above! 🚀         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
