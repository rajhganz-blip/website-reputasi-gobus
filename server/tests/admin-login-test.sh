#!/bin/bash

# Admin Login Test Script
# Run: bash server/tests/admin-login-test.sh

set -e

HOST=${1:-http://localhost:3000}
USERNAME=${2:-admin}
PASSWORD=${3:-admin123}

echo "🧪 Testing Admin Login to: $HOST"
echo "Username: $USERNAME"
echo "Password: $PASSWORD"
echo ""

# Test 1: Check server is running
echo "1️⃣ Checking server health..."
if curl -s "$HOST/health" > /dev/null 2>&1; then
  echo "✅ Server is online"
else
  echo "❌ Server is DOWN at $HOST"
  exit 1
fi
echo ""

# Test 2: Attempt login
echo "2️⃣ Attempting admin login..."
LOGIN_RESPONSE=$(curl -s -X POST "$HOST/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

echo "Response:"
echo "$LOGIN_RESPONSE" | head -c 500
echo ""
echo ""

# Parse token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed - no token in response"
  echo "Full response:"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "Token (first 50 chars): ${TOKEN:0:50}..."
echo ""

# Test 3: Use token to access protected endpoint
echo "3️⃣ Testing token with protected endpoint (/api/admin/stats)..."
STATS_RESPONSE=$(curl -s -X GET "$HOST/api/admin/stats" \
  -H "x-admin-token: $TOKEN")

echo "Response:"
echo "$STATS_RESPONSE" | head -c 500
echo ""

if echo "$STATS_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Admin token is valid and working!"
else
  echo "⚠️ Token might be invalid or stats endpoint failed"
fi

echo ""
echo "✅ All tests completed!"
