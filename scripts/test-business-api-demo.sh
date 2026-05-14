#!/bin/bash
# Test the Blaze CLI agent with business API key + Bedrock
# Replace YOUR_API_KEY_HERE with your actual business API key

export BLAZE_API_KEY="YOUR_API_KEY_HERE"
export BLAZE_LLM_PROVIDER=bedrock
export AWS_REGION=us-east-1

CLI="/Users/luc/Projects/blaze/.conductor/missoula-v1/blaze-cli/dist/cli/index.js"

echo "============================================"
echo "  Blaze CLI Agent — Business API Demo"
echo "  Provider: AWS Bedrock"
echo "============================================"
echo ""

echo "--- Test 1: Check Balance ---"
node "$CLI" agent "what's my balance?" 2>/dev/null
echo ""
echo ""

echo "--- Test 2: Create Payment Link ---"
node "$CLI" agent "create a payment link for 25 dollars named 'Demo Invoice'" 2>/dev/null
echo ""
echo ""

echo "--- Test 3: List Customers ---"
node "$CLI" agent "show me my customers" 2>/dev/null
echo ""
echo ""

echo "--- Test 4: Get FX Quote ---"
node "$CLI" agent "how much would it cost to send 100 USD to Mexico in MXN?" 2>/dev/null
echo ""
echo ""

echo "--- Test 5: Natural Language Routing ---"
node "$CLI" agent "I need to charge a client 150 dollars for a consulting session" 2>/dev/null
echo ""
echo ""

echo "============================================"
echo "  Demo Complete"
echo "============================================"
