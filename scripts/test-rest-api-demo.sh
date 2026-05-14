#!/bin/bash
# Test the Blaze REST API directly with curl
# Replace YOUR_API_KEY_HERE with your actual business API key

API_KEY="YOUR_API_KEY_HERE"
BASE_URL="https://api.blaze.money"

echo "============================================"
echo "  Blaze REST API — Business Endpoints Demo"
echo "  Base URL: $BASE_URL"
echo "============================================"
echo ""

echo "--- 1. GET /v1/balance ---"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/v1/balance" | python3 -m json.tool
echo ""
echo ""

echo "--- 2. GET /v1/customers (first 5) ---"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/v1/customers?limit=5" | python3 -m json.tool
echo ""
echo ""

echo "--- 3. GET /v1/transactions (last 5) ---"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/v1/transactions?limit=5" | python3 -m json.tool
echo ""
echo ""

echo "--- 4. GET /v1/fx/rates ---"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/v1/fx/rates" | python3 -m json.tool
echo ""
echo ""

echo "--- 5. POST /v1/fx/quotes (100 USD → MXN) ---"
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"from_currency":"USD","to_currency":"MXN","amount":100}' \
  "$BASE_URL/v1/fx/quotes" | python3 -m json.tool
echo ""
echo ""

echo "--- 6. POST /v1/payment-links (create $25 link) ---"
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"amount":25,"currency":"USD","name":"Demo Test Link","note":"Created via REST API test"}' \
  "$BASE_URL/v1/payment-links" | python3 -m json.tool
echo ""
echo ""

echo "--- 7. GET /v1/payment-links (list) ---"
curl -s -H "X-API-Key: $API_KEY" "$BASE_URL/v1/payment-links?limit=3" | python3 -m json.tool
echo ""
echo ""

echo "============================================"
echo "  Done! Replace YOUR_API_KEY_HERE to run."
echo "============================================"
