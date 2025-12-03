# Quick Start Guide - LLM Brand Visibility Tracking

## 🚀 Setup (5 minutes)

### 1. Install Dependencies

```bash
cd backend-llm
pnpm install
```

### 2. Configure Environment

Edit `.env` and add at least one API key:

```env
# Required
BACKEND_LLM_DATABASE_URI=mongodb+srv://<username>:<password>@URI.COM
PORT=3000

# At least one is required
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Start the Server

```bash
pnpm run start:dev
```

Wait for: `🚀 'RPC' server is running: http://0.0.0.0:3000/`

## 📝 Quick Test (Using CLI)

### Option 1: Use the CLI Tool

```bash
# Create a run from example config
node cli.js create-run --config config.example.json --run 0

# Watch progress in real-time
node cli.js watch <run-id-from-above>

# Get summary once complete
node cli.js get-summary <run-id>

# Export report
node cli.js export-report <run-id> --output my-report.json
```

### Option 2: Use cURL

```bash
# Create a run
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best payment processor for startups?",
      "Which CRM should I use for my small business?"
    ],
    "brands": ["Stripe", "Square", "PayPal", "Salesforce", "HubSpot"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" }
    ]
  }'

# Save the run ID from response, then check status
curl http://localhost:3000/runs/<RUN_ID>

# Get summary (wait until status is "completed")
curl http://localhost:3000/runs/<RUN_ID>/summary | jq '.'
```

### Option 3: Use the Test Script

```bash
# Automated test with progress tracking
./test-run.sh
```

## 📊 Understanding the Results

The summary endpoint returns:

```json
{
  "run": {
    /* run metadata */
  },
  "brandMetrics": [
    {
      "brandName": "Stripe",
      "totalMentions": 5,
      "mentionRate": 0.67, // 67% of responses mentioned this brand
      "byPrompt": [
        {
          "promptText": "What is the best payment processor?",
          "mentioned": true,
          "mentionCount": 2,
          "models": ["gpt-4o-mini", "gpt-3.5-turbo"]
        }
      ]
    }
  ],
  "promptMetrics": [
    /* aggregated by prompt */
  ]
}
```

## 🎯 Common Use Cases

### Track Multiple Brands Across Providers

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What CRM should I use?",
      "Best marketing automation tool?",
      "Recommend an analytics platform?"
    ],
    "brands": [
      "Salesforce", "HubSpot", "Zoho",
      "Marketo", "Pardot",
      "Google Analytics", "Mixpanel"
    ],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" },
      { "model": "gpt-3.5-turbo", "provider": "openai" },
      { "model": "claude-3-5-haiku-20241022", "provider": "anthropic" }
    ],
    "config": {
      "concurrencyLimit": 5,
      "retryAttempts": 3,
      "timeout": 30000
    }
  }'
```

### Large-Scale Test (100+ prompts)

Create a JSON file with your prompts and brands:

```json
{
  "prompts": [
    /* 100+ prompts */
  ],
  "brands": [
    /* 20+ brands */
  ],
  "models": [
    { "model": "gpt-4o-mini", "provider": "openai" },
    { "model": "claude-3-5-haiku-20241022", "provider": "anthropic" }
  ],
  "config": {
    "concurrencyLimit": 10,
    "retryAttempts": 3,
    "timeout": 30000
  }
}
```

Then:

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d @large-test.json
```

## 🔍 Monitoring

### List All Runs

```bash
curl http://localhost:3000/runs?page=1&limit=10 | jq '.'
```

### Check Run Status

```bash
curl http://localhost:3000/runs/<RUN_ID> | jq '.'
```

Status values:

- `pending`: Run created, not started
- `running`: Currently processing
- `completed`: All prompts succeeded
- `partial`: Some prompts succeeded, some failed
- `failed`: All prompts failed

## 🐛 Troubleshooting

### "OpenAI API key not configured"

→ Add `OPENAI_API_KEY` to `.env`

### "Anthropic API key not configured"

→ Add `ANTHROPIC_API_KEY` to `.env`

### Run stuck in "running" status

→ Check server logs: `pnpm run start:dev`
→ Likely API rate limit or network issue

### "Run not found"

→ Check the run ID is correct
→ Runs are stored in MongoDB, verify connection

## 📚 Next Steps

- Read full documentation: `LLM_VISIBILITY_README.md`
- Customize prompts: Edit `config.example.json`
- Scale up: See "Scalability & Production Readiness" section
- Add more LLM providers: Extend `llm-provider.service.ts`

## 💡 Tips

1. **Start small**: Test with 2-3 prompts first
2. **Reuse prompts**: Prompts are de-duplicated across runs
3. **Monitor costs**: Each prompt × model = 1 API call
4. **Use caching**: Same prompt+model uses cached results (future enhancement)
5. **Adjust concurrency**: Lower if hitting rate limits

---

**Need help?** Check the logs or review the full README.
