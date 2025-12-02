#!/bin/bash

# LLM Visibility Tracking Service - Test Script

BASE_URL="http://localhost:3000/llm-visibility"

echo "=========================================="
echo "LLM Visibility Tracking Service - Test"
echo "=========================================="
echo ""

# Test 1: Create a run
echo "1. Creating a new run..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best B2B payments platform for startups?",
      "Which CRM software should I use for my small business?",
      "Recommend an analytics tool for e-commerce websites"
    ],
    "brands": [
      "Stripe",
      "Square",
      "PayPal",
      "Salesforce",
      "HubSpot",
      "Zoho",
      "Google Analytics",
      "Mixpanel"
    ],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" },
      { "model": "gpt-3.5-turbo", "provider": "openai" }
    ],
    "notes": "Test run from script",
    "config": {
      "concurrencyLimit": 3,
      "retryAttempts": 2,
      "timeout": 30000
    }
  }')

echo "$RUN_RESPONSE" | jq '.'
echo ""

# Extract run ID
RUN_ID=$(echo "$RUN_RESPONSE" | jq -r '.run._id')

if [ "$RUN_ID" == "null" ] || [ -z "$RUN_ID" ]; then
  echo "❌ Failed to create run"
  exit 1
fi

echo "✅ Run created with ID: $RUN_ID"
echo ""

# Test 2: List runs
echo "2. Listing all runs..."
curl -s "$BASE_URL/runs?page=1&limit=10" | jq '.'
echo ""

# Test 3: Get specific run
echo "3. Getting run details..."
curl -s "$BASE_URL/runs/$RUN_ID" | jq '.'
echo ""

# Test 4: Wait for completion and get summary
echo "4. Waiting for run to complete..."
MAX_WAIT=120  # 2 minutes
WAITED=0
STATUS="pending"

while [ "$STATUS" != "completed" ] && [ "$STATUS" != "failed" ] && [ "$STATUS" != "partial" ] && [ $WAITED -lt $MAX_WAIT ]; do
  sleep 5
  WAITED=$((WAITED + 5))
  
  RUN_STATUS=$(curl -s "$BASE_URL/runs/$RUN_ID" | jq -r '.status')
  STATUS="$RUN_STATUS"
  
  COMPLETED=$(curl -s "$BASE_URL/runs/$RUN_ID" | jq -r '.completedPrompts')
  TOTAL=$(curl -s "$BASE_URL/runs/$RUN_ID" | jq -r '.totalPrompts')
  
  echo "   Status: $STATUS - Progress: $COMPLETED/$TOTAL (${WAITED}s elapsed)"
done

echo ""

if [ "$STATUS" == "completed" ] || [ "$STATUS" == "partial" ]; then
  echo "✅ Run completed with status: $STATUS"
  echo ""
  
  # Test 5: Get summary
  echo "5. Getting run summary..."
  SUMMARY=$(curl -s "$BASE_URL/runs/$RUN_ID/summary")
  echo "$SUMMARY" | jq '.'
  echo ""
  
  # Extract key metrics
  echo "=========================================="
  echo "KEY METRICS"
  echo "=========================================="
  echo ""
  
  echo "Brand Visibility:"
  echo "$SUMMARY" | jq -r '.brandMetrics[] | "\(.brandName): \(.totalMentions) mentions, \(.mentionRate * 100 | floor)% mention rate"'
  echo ""
  
  echo "Top Mentioned Brands:"
  echo "$SUMMARY" | jq -r '.brandMetrics | sort_by(-.totalMentions) | .[0:3] | .[] | "  \(.totalMentions)x - \(.brandName)"'
  echo ""
  
else
  echo "❌ Run failed or timed out after ${WAITED}s"
  echo "   Final status: $STATUS"
fi

echo ""
echo "=========================================="
echo "Test complete!"
echo "=========================================="
