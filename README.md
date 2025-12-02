<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Backend LLM - Brand Visibility Tracking Service

A scalable NestJS service for tracking brand mentions across multiple LLM providers (OpenAI, Anthropic). Built to analyze how different AI models respond to prompts and which brands they mention.

## 🎯 What This Does

This service allows you to:

- Submit batches of prompts to multiple LLM models
- Track which brands are mentioned in AI-generated responses
- Measure brand visibility across different prompts and models
- Get aggregated metrics on mention rates, positions, and frequency

**Perfect for:** Competitive intelligence, brand monitoring, SEO for AI, and understanding LLM behaviors.

## 🚀 Quick Start

See **[QUICKSTART.md](./QUICKSTART.md)** for a 5-minute setup guide.

**TL;DR:**

```bash
# 1. Install
pnpm install

# 2. Configure .env with API keys
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key

# 3. Start server
pnpm run start:dev

# 4. Create a run (in another terminal)
node cli.js create-run --config config.example.json --run 0

# 5. Watch progress
node cli.js watch <run-id>
```

## 📚 Documentation

- **[SCALABILITY.md](./SCALABILITY.md)** - **Comprehensive scalability & reliability guide**:

  - Current implementation details (rate limiting, circuit breaker, idempotency)
  - Scaling to 100k+ prompts/day architecture
  - Production deployment strategies
  - Cost analysis and optimization

- **[LLM_VISIBILITY_README.md](./LLM_VISIBILITY_README.md)** - Full documentation including:

  - Complete API reference
  - Architecture overview
  - Scalability analysis (100k prompts/day)
  - Production considerations
  - Cost estimations

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes

## 🔑 Key Features

### ✅ Core Functionality

- [x] Multi-provider support (OpenAI, Anthropic)
- [x] Batch processing with configurable concurrency
- [x] Brand mention analysis (position, count, context)
- [x] Comprehensive metrics and reporting
- [x] Retry logic with exponential backoff
- [x] Progress tracking and status monitoring

### ✅ API & Interface

- [x] RESTful HTTP API
- [x] Command-line interface (CLI)
- [x] Real-time progress monitoring
- [x] JSON export functionality

### ✅ Scalability & Reliability

- [x] Asynchronous batch processing
- [x] Concurrency control (rate limiting)
- [x] Defensive error handling (timeouts, retries)
- [x] Partial success tracking
- [x] Idempotent prompt/brand creation
- [x] **Circuit breaker pattern** (prevents cascading failures)
- [x] **Advanced rate limiting** (token bucket with burst support)
- [x] **Run idempotency** (key + content hash deduplication)
- [x] **Exponential backoff with jitter** (prevents thundering herd)
- [x] **Abort controllers** (proper timeout handling)
- [x] **Metrics tracking** (latency, tokens, cost estimation)

**See [SCALABILITY.md](./SCALABILITY.md) for detailed architecture and 100k prompts/day design.**

## 🏗️ Architecture

```
Client Request
    ↓
REST API / CLI
    ↓
LLM Visibility Service
    ├─→ Run Management
    ├─→ LLM Provider Service (OpenAI, Anthropic)
    ├─→ Brand Mention Analyzer
    └─→ Metrics Aggregator
    ↓
MongoDB (Runs, Prompts, Brands, Responses, Mentions)
```

### Database Schema

- **runs**: Execution batches with status and configuration
- **prompts**: Unique prompts (de-duplicated)
- **brands**: Brand names to track
- **responses**: LLM responses with metadata
- **brand_mentions**: Mention analysis results

## 📊 Example Usage

### Create a Run

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [
      "What is the best payment processor for startups?",
      "Which CRM should I use?"
    ],
    "brands": ["Stripe", "PayPal", "Salesforce", "HubSpot"],
    "models": [
      { "model": "gpt-4o-mini", "provider": "openai" },
      { "model": "claude-3-5-haiku-20241022", "provider": "anthropic" }
    ]
  }'
```

### Get Summary

```bash
curl http://localhost:3000/runs/<RUN_ID>/summary
```

**Response:**

```json
{
  "brandMetrics": [
    {
      "brandName": "Stripe",
      "totalMentions": 3,
      "mentionRate": 0.75,
      "byPrompt": [...]
    }
  ]
}
```

## 🎓 Scalability Considerations

### Current Capabilities

The implementation is designed for **production-scale workloads**:

- ✅ **100k+ prompts/day** (single instance)
- ✅ **Asynchronous batch processing** with configurable concurrency
- ✅ **Circuit breaker pattern** prevents cascading failures
- ✅ **Advanced rate limiting** (token bucket with burst support)
- ✅ **Idempotent operations** (key + content hash deduplication)
- ✅ **Defensive programming** (timeouts, exponential backoff with jitter)
- ✅ **Partial failure handling** (individual request failures don't crash runs)
- ✅ **Comprehensive metrics** (latency, tokens, cost tracking)

### Example: High-Concurrency Run

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": [...1000 prompts...],
    "brands": ["Stripe", "PayPal", "Square"],
    "models": [
      {"model": "gpt-4o-mini", "provider": "openai"},
      {"model": "claude-3-5-haiku-20241022", "provider": "anthropic"}
    ],
    "idempotencyKey": "batch-2024-001",
    "config": {
      "concurrencyLimit": 20,
      "retryAttempts": 3,
      "timeout": 30000,
      "enableCircuitBreaker": true
    }
  }'
```

### System Architecture

```
Client Request → REST API (non-blocking)
                     ↓
              Background Worker
                     ↓
    ┌────────────────┼────────────────┐
    ↓                ↓                ↓
Rate Limiter   Circuit Breaker   Retry Logic
(Token Bucket)  (3 states)      (Exp backoff)
    ↓                ↓                ↓
    └────────────────┴────────────────┘
                     ↓
              LLM Providers
         (OpenAI, Anthropic)
                     ↓
              MongoDB Storage
```

### Scaling to 100k+ Prompts/Day

**For 100k prompts/day**, the architecture would need:

1. **Job Queue** (BullMQ + Redis)

   - Distributed processing across workers
   - Persistent job storage for reliability
   - Priority queues for urgent runs

2. **Horizontal Scaling** (Kubernetes)

   - 5-10 worker pods (auto-scaling)
   - 2-3 API pods (stateless)
   - Global rate limiter (Redis-backed)

3. **Database Optimization**

   - MongoDB replica set (1 primary + 2 secondaries)
   - Bulk operations for writes
   - Read replicas for queries

4. **Caching Layer** (Redis)

   - Cache frequent prompt responses
   - 20% cache hit rate = 20% cost savings

5. **Monitoring & Observability**
   - Prometheus + Grafana dashboards
   - Distributed tracing (OpenTelemetry)
   - Error tracking (Sentry)

**See [SCALABILITY.md](./SCALABILITY.md) for detailed architecture, cost analysis, and production deployment strategies.**

## 🧪 Testing

```bash
# Manual test script
./test-run.sh

# Using CLI
node cli.js create-run --config config.example.json --run 0
node cli.js watch <run-id>

# Unit tests
pnpm test

# E2E tests
pnpm test:e2e
```

## 📁 Project Structure

```
src/
├── repositories/
│   └── llm-visibility/
│       ├── schemas/           # MongoDB schemas
│       ├── llm-provider.service.ts   # LLM API integration
│       ├── llm-visibility.service.ts  # Core business logic
│       ├── llm-visibility.controller.ts  # REST endpoints
│       ├── llm-visibility.repositories.ts  # Data access
│       └── llm-visibility.module.ts
├── app.module.ts
└── main.ts

cli.js                 # Command-line interface
config.example.json    # Example configuration
test-run.sh           # Automated test script
```

## 🔧 Configuration

### Environment Variables

```env
# Database
BACKEND_LLM_DATABASE_URI=mongodb://localhost:27017
MONGODB_POOL_SIZE=10
PORT=3000

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Run Configuration

```json
{
  "concurrencyLimit": 5, // Max concurrent LLM calls
  "retryAttempts": 3, // Retry count for failures
  "timeout": 30000 // Request timeout (ms)
}
```

## 🛠️ Tech Stack

- **Framework**: NestJS 11
- **Database**: MongoDB (Mongoose)
- **LLM SDKs**: OpenAI SDK, Anthropic SDK
- **Utilities**: p-limit (concurrency), axios (HTTP)
- **Language**: TypeScript

---

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
