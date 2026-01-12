#!/bin/bash

# Test script for the generate-upload-url edge function
#
# Prerequisites:
# 1. Supabase CLI installed
# 2. R2 secrets configured: supabase secrets set R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... R2_ENDPOINT=...
# 3. A valid Supabase auth token (from a logged-in user)
#
# Usage:
#   ./test.sh <supabase-url> <auth-token>
#
# Example:
#   ./test.sh https://your-project.supabase.co eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

set -e

SUPABASE_URL="${1:-$SUPABASE_URL}"
AUTH_TOKEN="${2:-$AUTH_TOKEN}"

if [ -z "$SUPABASE_URL" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: ./test.sh <supabase-url> <auth-token>"
    echo ""
    echo "Or set environment variables:"
    echo "  export SUPABASE_URL=https://your-project.supabase.co"
    echo "  export AUTH_TOKEN=your-jwt-token"
    echo ""
    echo "To get an auth token, sign in via the app or use:"
    echo "  curl -X POST '$SUPABASE_URL/auth/v1/token?grant_type=password' \\"
    echo "    -H 'apikey: <anon-key>' \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -d '{\"email\": \"user@example.com\", \"password\": \"password\"}'"
    exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/generate-upload-url"

echo "=== Testing generate-upload-url Edge Function ==="
echo ""
echo "Function URL: $FUNCTION_URL"
echo ""

# Test 1: Photo upload URL generation
echo "--- Test 1: Generate photo upload URL ---"
PHOTO_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "fileType": "photo",
        "fileSize": 1048576,
        "contentType": "image/jpeg",
        "fileName": "test-photo.jpg"
    }')

echo "Response: $PHOTO_RESPONSE"
echo ""

# Extract upload URL if successful
UPLOAD_URL=$(echo "$PHOTO_RESPONSE" | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
if [ -n "$UPLOAD_URL" ]; then
    echo "Upload URL generated successfully!"
    echo ""

    # Test 2: Actually upload a test file (optional)
    echo "--- Test 2: Upload test file using pre-signed URL ---"
    echo "Creating test file..."
    dd if=/dev/urandom of=/tmp/test-upload.jpg bs=1024 count=100 2>/dev/null

    echo "Uploading to R2..."
    UPLOAD_RESULT=$(curl -s -X PUT "$UPLOAD_URL" \
        -H "Content-Type: image/jpeg" \
        -H "Content-Length: 102400" \
        --data-binary @/tmp/test-upload.jpg \
        -w "\nHTTP Status: %{http_code}")

    echo "Upload result: $UPLOAD_RESULT"

    # Clean up
    rm -f /tmp/test-upload.jpg
    echo ""
fi

# Test 3: Video upload URL generation
echo "--- Test 3: Generate video upload URL ---"
VIDEO_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "fileType": "video",
        "fileSize": 52428800,
        "contentType": "video/mp4"
    }')

echo "Response: $VIDEO_RESPONSE"
echo ""

# Test 4: Invalid file type (should fail)
echo "--- Test 4: Invalid file type (should return error) ---"
INVALID_TYPE_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "fileType": "document",
        "fileSize": 1024,
        "contentType": "application/pdf"
    }')

echo "Response: $INVALID_TYPE_RESPONSE"
echo ""

# Test 5: File too large (should fail)
echo "--- Test 5: File too large (should return error) ---"
TOO_LARGE_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "fileType": "photo",
        "fileSize": 104857600,
        "contentType": "image/jpeg"
    }')

echo "Response: $TOO_LARGE_RESPONSE"
echo ""

# Test 6: Missing auth token (should fail)
echo "--- Test 6: Missing auth token (should return 401) ---"
NO_AUTH_RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "fileType": "photo",
        "fileSize": 1024,
        "contentType": "image/jpeg"
    }')

echo "Response: $NO_AUTH_RESPONSE"
echo ""

echo "=== Tests Complete ==="
