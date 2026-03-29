#!/bin/bash

# Authority Supervisory Role - Quick Start Guide

echo "=========================================="
echo "Authority Role - Quick Start"
echo "=========================================="
echo ""

# Step 1: Database Migration
echo "Step 1: Running database migration..."
cd backend
node runAuthorityMigration.js
echo ""

# Step 2: Create Authority User
echo "Step 2: Creating authority user..."
echo "Run this SQL in your MySQL client:"
echo ""
echo "INSERT INTO users (name, email, password_hash, role, created_at)"
echo "VALUES ("
echo "  'Government Officer',"
echo "  'authority@scrs.gov',"
echo "  '\$2a\$10\$YOixf.H5XRPvLCJ9e9.8n.Nj6lCKE6F8RJkKIVVE5z9WLKr5KL2gu',"  # password: "password"
echo "  'authority',"
echo "  NOW()"
echo ");"
echo ""

# Step 3: Start Server
echo "Step 3: Starting server..."
echo "Run: node server.js"
echo ""

# Step 4: Get Token
echo "Step 4: Getting JWT token..."
echo "curl -X POST http://localhost:3000/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"authority@scrs.gov\",\"password\":\"password\"}'"
echo ""

# Step 5: Test Endpoints
echo "Step 5: Testing endpoints..."
echo ""
echo "View all complaints:"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  'http://localhost:3000/authority/complaints?priority=High'"
echo ""

echo "Get dashboard analytics:"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  http://localhost:3000/authority/dashboard"
echo ""

echo "Override complaint priority:"
echo "curl -X PUT -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"new_priority\":\"Critical\"}' \\"
echo "  http://localhost:3000/authority/complaints/1/priority"
echo ""

echo "Reassign complaint:"
echo "curl -X PUT -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"admin_id\":7}' \\"
echo "  http://localhost:3000/authority/complaints/1/assign"
echo ""

echo "Export as CSV:"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  http://localhost:3000/authority/export > complaints.csv"
echo ""

echo "=========================================="
echo "Implementation Complete!"
echo "=========================================="
