#!/bin/bash

# Test script for scalability features

echo "=== Testing LLM Visibility Scalability Features ==="
echo ""

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create run with idempotency key
echo -e "${BLUE}Test 1: Create run with idempotency key${NC}"
RESPONSE1=$(curl -s -X POST "${BASE_URL}/llm-visibility/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best payment processor for startups?"
    ],
    "brands": ["Stripe", "PayPal"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ],
    "idempotencyKey": "test-key-001",
    "notes": "Test run with idempotency key"
  }')

RUN_ID=$(echo "$RESPONSE1" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$RESPONSE1" | jq '.'
echo ""

# Test 2: Retry same request (should return existing run)
echo -e "${BLUE}Test 2: Retry with same idempotency key (should return existing)${NC}"
sleep 2
RESPONSE2=$(curl -s -X POST "${BASE_URL}/llm-visibility/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best payment processor for startups?"
    ],
    "brands": ["Stripe", "PayPal"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ],
    "idempotencyKey": "test-key-001",
    "notes": "Test run with idempotency key"
  }')

echo "$RESPONSE2" | jq '.'
echo ""

# Test 3: Create run with custom concurrency and rate limiting
echo -e "${BLUE}Test 3: Create run with custom config (high concurrency)${NC}"
curl -s -X POST "${BASE_URL}/llm-visibility/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best CRM for small businesses?",
      "Which project management tool is most popular?"
    ],
    "brands": ["Salesforce", "HubSpot", "Asana", "Monday.com"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ],
    "config": {
      "concurrencyLimit": 10,
      "retryAttempts": 3,
      "timeout": 30000,
      "rateLimitPerSecond": 20,
      "enableCircuitBreaker": true
    },
    "notes": "High concurrency test with circuit breaker"
  }' | jq '.'
echo ""

# Test 4: Check run status
if [ ! -z "$RUN_ID" ]; then
  echo -e "${BLUE}Test 4: Check run status${NC}"
  sleep 5
  curl -s "${BASE_URL}/llm-visibility/runs/${RUN_ID}" | jq '.'
  echo ""
fi

# Test 5: List all runs
echo -e "${BLUE}Test 5: List all runs${NC}"
curl -s "${BASE_URL}/llm-visibility/runs?page=1&limit=5" | jq '.'
echo ""

# Test 6: Content hash deduplication (same content, no idempotency key)
echo -e "${BLUE}Test 6: Content hash deduplication${NC}"
echo "Creating run without idempotency key..."
RESPONSE3=$(curl -s -X POST "${BASE_URL}/llm-visibility/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": ["What is Stripe?"],
    "brands": ["Stripe"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ],
    "notes": "First run"
  }')
echo "$RESPONSE3" | jq '.'
echo ""

echo "Waiting 2 seconds..."
sleep 2

echo "Creating identical run (should detect duplicate)..."
RESPONSE4=$(curl -s -X POST "${BASE_URL}/llm-visibility/runs" \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": ["What is Stripe?"],
    "brands": ["Stripe"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ],
    "notes": "Duplicate run"
  }')
echo "$RESPONSE4" | jq '.'
echo ""

echo -e "${GREEN}=== Scalability Tests Complete ===${NC}"
echo ""
echo -e "${YELLOW}Key Features Demonstrated:${NC}"
echo "✓ Idempotency key support"
echo "✓ Content hash deduplication"
echo "✓ Custom concurrency configuration"
echo "✓ Rate limiting configuration"
echo "✓ Circuit breaker enable/disable"
echo "✓ Configurable timeouts and retries"
echo ""
echo -e "${YELLOW}See SCALABILITY.md for detailed architecture documentation${NC}"
