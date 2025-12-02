# LLM Brand Visibility Tracking Service

**A production-ready NestJS service for tracking brand mentions across multiple LLM providers (OpenAI, Anthropic).**

This is a full-stack solution with:

- ✅ **Backend API**: NestJS + MongoDB with circuit breaker, rate limiting, and comprehensive error handling
- ✅ **Frontend Dashboard**: React + Material-UI for real-time monitoring
- ✅ **CLI Tool**: Command-line interface for automation
- ✅ **Production Features**: Idempotency, retry logic, metrics tracking, and scalability patterns

## 🎯 What This Does

Track how AI models mention brands in their responses:

- **Batch Processing**: Submit 100s-1000s of prompts to multiple LLM models simultaneously
- **Brand Analysis**: Detect which brands appear, where, and how often
- **Multi-Provider**: OpenAI and Anthropic support with extensible architecture
- **Metrics & Insights**: Mention rates, positions, frequency analysis across prompt/model combinations

**Use Cases:** Competitive intelligence, brand monitoring, SEO for AI, LLM behavior analysis.

## 🚀 Quick Start (5 Minutes)

### Option 1: Docker (Recommended - Fastest)

```bash
# 1. Clone and navigate to project
cd project

# 2. Set up environment with API keys
cp .env.example .env
# Edit .env and add your API keys:
# OPENAI_API_KEY=sk-your-key
# ANTHROPIC_API_KEY=sk-ant-your-key

# 3. Start everything with Docker
docker compose up -d --build

# 4. Access the services
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
# RedisInsight: http://localhost:5540

# 5. Test it out
cd backend-llm
node cli.js create-run --config config.example.json --run 0
node cli.js watch <run-id>
```

**Docker includes:**

- ✅ Backend API (NestJS)
- ✅ Frontend Dashboard (React)
- ✅ MongoDB (with persistent storage)
- ✅ Redis (with RedisInsight GUI)
- ✅ Health checks & automatic restarts
- ✅ Optimized production builds

See **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** for detailed Docker commands and troubleshooting.

### Option 2: Manual Setup (Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Start MongoDB & Redis
docker compose up -d mongodb redis

# 3. Configure environment
cd backend-llm
cp .env.example .env
# Add your API keys & connection strings to .env

# 4. Start backend (development mode)
pnpm run start:dev

# 5. (Optional) Start frontend dashboard
cd ../frontend-llm
npm install && npm start
# Visit http://localhost:3001

# 6. Test it out (in another terminal)
cd backend-llm
node cli.js create-run --config config.example.json --run 0
node cli.js create-run --config config.scalability.json --run 2
node cli.js watch <run-id>
```

**That's it!** The system will process prompts, call LLMs, analyze brand mentions, and show results.

See **[QUICKSTART.md](./QUICKSTART.md)** for detailed setup including troubleshooting.

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

## 🏗️ Architecture & Design Decisions

### Clear Separation of Concerns

```
┌─────────────────────────────────────────────────────────────┐
│                     Controller Layer                        │
│  (HTTP/REST API, request validation, response formatting)   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   Service Layer                             │
│  • LLMVisibilityService: Orchestration & business logic     │
│  • LLMProviderService: LLM client abstraction               │
│  • Brand analysis & metrics aggregation                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 Repository Layer                            │
│  • Abstract base repository (CRUD operations)               │
│  • Type-safe MongoDB access with Mongoose                   │
│  • Schema definitions & data modeling                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Infrastructure Layer                           │
│  • Circuit Breaker (failure isolation)                      │
│  • Rate Limiter (token bucket algorithm)                    │
│  • Redis (distributed state)                                │
│  • Configuration management                                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles

**1. Provider Abstraction**

- `LLMProviderService` wraps OpenAI/Anthropic SDKs with unified interface
- Easy to add new providers (Gemini, Mistral, etc.) without changing business logic
- Consistent error handling and retry logic across providers

**2. Async by Default**

- Non-blocking API: `/runs` endpoint returns immediately with run ID
- Background processing with configurable concurrency (p-limit)
- Client polls for status or uses CLI watch mode

**3. Failure Resilience**

- **Circuit Breaker**: Opens after threshold failures, prevents cascading issues
- **Exponential Backoff with Jitter**: Avoids thundering herd on retries
- **Partial Success Tracking**: Individual prompt failures don't crash entire run
- **Timeouts**: AbortController for clean timeout handling

**4. Data Modeling**

- Normalized schema: Prompts/Brands de-duplicated (idempotent inserts)
- Rich metadata: Latency, token usage, cost estimation per response
- Run-level status tracking: `pending` → `processing` → `completed`/`failed`

## 📊 API Examples

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
    ],
    "idempotencyKey": "optional-dedup-key",
    "config": {
      "concurrencyLimit": 5,
      "retryAttempts": 3,
      "timeout": 30000
    }
  }'
```

**Response:**

```json
{
  "_id": "674d1234567890abcdef",
  "status": "pending",
  "totalTasks": 4,
  "message": "Run created successfully"
}
```

### Get Run Status

```bash
curl http://localhost:3000/runs/674d1234567890abcdef
```

**Response:**

```json
{
  "_id": "674d1234567890abcdef",
  "status": "completed",
  "completedAt": "2024-12-02T10:30:00Z",
  "stats": {
    "totalTasks": 4,
    "completedTasks": 4,
    "failedTasks": 0,
    "totalTokens": 1247,
    "totalLatency": 3521,
    "estimatedCost": 0.0012
  }
}
```

### Get Brand Summary

```bash
curl http://localhost:3000/runs/674d1234567890abcdef/summary
```

**Response:**

```json
{
  "brandMetrics": [
    {
      "brandName": "Stripe",
      "totalMentions": 3,
      "mentionRate": 0.75,
      "averagePosition": 2,
      "byPrompt": [
        {
          "promptText": "What is the best payment processor...",
          "mentions": 2,
          "byModel": [
            {
              "model": "gpt-4o-mini",
              "mentioned": true,
              "positions": [1, 3]
            }
          ]
        }
      ]
    }
  ]
}
```

### Get Chat View

```bash
curl http://localhost:3000/runs/674d1234567890abcdef/chat
```

**Response:** Grouped conversations showing full LLM responses with metadata

```json
{
  "conversations": [
    {
      "prompt": "What is the best payment processor for startups?",
      "responses": [
        {
          "model": "gpt-4o-mini",
          "provider": "openai",
          "response": "For startups, I'd recommend Stripe...",
          "brandsMentioned": ["Stripe", "PayPal"],
          "metadata": {
            "latency": 1247,
            "tokens": { "input": 15, "output": 87 },
            "timestamp": "2024-12-02T10:29:45Z"
          }
        }
      ]
    }
  ]
}
```

---

## 🧪 Testing & Validation

### Using the CLI

```bash
# Create run from config file
node cli.js create-run --config config.example.json --run 0

# Watch progress in real-time
node cli.js watch <run-id>

# Export results to JSON
node cli.js export <run-id> > results.json
```

## 📁 Project Structure

```
.
├── backend-llm/                    # NestJS Backend API
│   ├── src/
│   │   ├── app.module.ts          # Root module
│   │   ├── app.service.ts         # App service
│   │   ├── main.ts                # Application entry point
│   │   ├── controller/
│   │   │   ├── app.controller.ts           # Health check endpoints
│   │   │   └── llm-visibility.controller.ts # Main API controller
│   │   ├── libs/
│   │   │   ├── circuit-breaker-module/     # Circuit breaker implementation
│   │   │   ├── nestjs-config-module/       # Configuration management
│   │   │   ├── rate-limiter-module/        # Rate limiting
│   │   │   ├── redis-module/               # Redis integration
│   │   │   └── types/                      # Shared types
│   │   └── repositories/
│   │       ├── base.repository.ts          # Base repository pattern
│   │       └── llm-visibility/
│   │           ├── schemas/                # MongoDB schemas (Run, Prompt, Brand, etc.)
│   │           ├── services/
│   │           │   ├── llm-provider.service.ts      # LLM API integration
│   │           │   └── llm-visibility.service.ts    # Core business logic
│   │           ├── llm-visibility.controller.ts     # REST endpoints
│   │           ├── llm-visibility.repositories.ts   # Data access layer
│   │           ├── llm-visibility.module.ts         # Feature module
│   │           └── types/                           # Feature-specific types
│   ├── cli.js                     # Command-line interface
│   ├── config.example.json        # Example configuration
│   ├── config.scalability.json    # Scalability test config
│   ├── test-run.sh               # Automated test script
│   ├── test-scalability.sh       # Scalability test script
│   └── package.json
│
├── frontend-llm/                  # React Frontend Dashboard
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js                # Main app component
│   │   ├── App.css               # App styles
│   │   ├── index.js              # React entry point
│   │   ├── components/
│   │   │   ├── RunList.js        # Run listing carousel with pagination
│   │   │   ├── RunList.css       # Run list styles
│   │   │   ├── RunDetails.js     # Run details with summary/chat tabs
│   │   │   └── RunDetails.css    # Run details styles
│   │   ├── services/
│   │   │   └── api.js            # API client (fetch runs, summary, chat)
│   │   └── styles/
│   │       └── common.css        # Shared styles
│   └── package.json
│
│
├── README.md                      # This file
├── QUICKSTART.md                  # 5-minute setup guide
└── package.json                   # Workspace root
```

### Key Components

**Backend (`backend-llm/`)**

- **Controllers**: REST API endpoints with comprehensive logging
- **Services**: Business logic for LLM integration and brand analysis
- **Repositories**: MongoDB data access with Mongoose
- **Libs**: Reusable modules (circuit breaker, rate limiter, Redis)
- **CLI**: Command-line tool for run management

**Frontend (`frontend-llm/`)**

- **Material-UI**: Modern React UI components
- **RunList**: Horizontal carousel with search, sort, pagination
- **RunDetails**: Tabbed view (Summary/Chat) with real-time updates
- **API Service**: Centralized API client with auto-refresh

---

## 🛠️ Tech Stack & Dependencies

### Backend

- **NestJS 11**: Modular architecture, dependency injection, TypeScript-first
- **MongoDB + Mongoose**: Document store for flexible schema, rich querying
- **LLM SDKs**: Official OpenAI & Anthropic SDKs (type-safe, auto-retries)
- **p-limit**: Concurrency control (battle-tested, 200M+ downloads)
- **Valkey/Redis** (optional): Distributed rate limiting, circuit breaker state

### Frontend

- **React 19**: Modern hooks, concurrent features
- **Material-UI v5**: Professional UI out-of-the-box
- **react-markdown**: Safe rendering of LLM responses

### Why These Choices?

- ✅ **NestJS**: Enterprise-grade DI, familiar to Java/C# devs, great for backend systems
- ✅ **MongoDB**: Schema flexibility for evolving LLM response formats
- ✅ **Official SDKs**: Provider handles retries, token counting, streaming (future)
- ⚠️ **No ORM for migrations**: MongoDB is schema-less, models are source of truth
- ⚠️ **No Prisma**: Would add for PostgreSQL, but Mongoose is standard for Mongo

---

## 🔧 Configuration

### Environment Variables

```env
# Database
BACKEND_LLM_DATABASE_URI=mongodb://localhost:27017/llm-visibility
MONGODB_POOL_SIZE=10

# Server
PORT=3000
NODE_ENV=development

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Redis for distributed rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Run Configuration Options

```json
{
  "concurrencyLimit": 5, // Max parallel LLM calls (default: 5)
  "retryAttempts": 3, // Retry failed requests (default: 3)
  "timeout": 30000, // Request timeout in ms (default: 30s)
  "enableCircuitBreaker": true, // Enable failure isolation (default: true)
  "rateLimitPerMinute": 60 // Requests per minute cap (default: 60)
}
```

**Tuning Tips:**

- � Higher concurrency = faster completion, but higher rate limit risk
- 🔧 Longer timeout = handle slow models (Claude can be slower)
- 🔧 Disable circuit breaker for testing, enable for production

---

## 📚 Documentation

This README covers architecture and trade-offs. For specific details:

- **[QUICKSTART.md](./QUICKSTART.md)** - Complete setup guide (Docker, environment, first run)
- **[REDIS_KEYS.md](./backend-llm/REDIS_KEYS.md)** - Redis key patterns for distributed mode

---

### Quick Start with Docker

```bash
# Complete setup in one command
./docker-helper.sh setup

# Other useful commands
./docker-helper.sh start       # Start all services
./docker-helper.sh stop        # Stop all services
./docker-helper.sh logs        # View logs
./docker-helper.sh status      # Check service status
./docker-helper.sh cli <args>  # Run CLI commands in container
```

See **[DOCKER_SETUP.md](./DOCKER_SETUP.md)** for complete Docker documentation.

## 🤝 Contributing & Development

```bash
# Install dependencies
pnpm install

# Start backend in development mode
cd backend-llm && pnpm run start:dev

# Start frontend (optional)
cd frontend-llm && npm start
```

## 📊 Project Summary

### What's Been Built

**Small, Solid Core:**

- ✅ Working end-to-end: API → LLM providers → MongoDB → Frontend
- ✅ ~15 files of core logic (controllers, services, repositories)
- ✅ Production patterns: circuit breaker, rate limiter, idempotency, retry logic
- ✅ Runs with minimal fuss: `pnpm install && pnpm start:dev`

**Clear Abstractions:**

- `LLMProviderService`: Unified interface for OpenAI/Anthropic (easy to extend)
- `CircuitBreaker` + `RateLimiter`: Reusable infrastructure modules
- Repository pattern: Clean separation between data access and business logic
- No over-engineering: In-process workers are fine until you need to scale

**Systems Thinking:**

- Parallelism: Configurable concurrency with p-limit
- Failure handling: Circuit breaker, exponential backoff, partial success tracking
- Observability: Comprehensive logging at every critical point
- Scalability: Documented path from single instance → 100k prompts/day

**Pragmatic Choices:**

- CLI tool for quick testing (`node cli.js create-run`)
- Example configs ready to copy-paste
- Manual logging vs APM (works everywhere, zero dependencies)
- In-memory rate limiting (simple, upgrade to Redis when needed)

# 🚀 Backend-First Production Roadmap (Prioritized)

**Estimated Timeline:** **2–3 months** from prototype → production-ready SaaS  
This roadmap is **backend-priority**, focusing on stability, scalability, storage, typing, and repository/package revamp before feature work.

---

### ✅ **Phase 1 — Core Backend Stability (Week 1–2)**

### **Horizontal Scaling**

- **Migrate to BullMQ job queue** (2–3 days)
  - Concurrency, retries, backoff, sandbox workers
- **Redis-backed rate limiter** (1 day)
- **Kubernetes deployment configs** (2–3 days)
  - HPA, resource limits, probes

### **Repository Package Revamp (High Priority)**

- Design a **new MongoDB repository interface** (1–2 days)
- Add **bulk helpers** (`bulkUpsert`, `bulkDelete`, `bulkInsert`) (1 day)
- Implement **query builder with type-safe chaining** (1–2 days)
- Add **strict TypeScript generics per collection** (1 day)
- Integrate **transaction support + index decorators** (1 day)

---

### ✅ **Phase 2 — Observability & Diagnostics (Week 3–4)**

- **OpenTelemetry distributed tracing** (3–4 days)
  - Trace: API → service → queue → worker → external LLM provider
- **Prometheus metrics + Grafana dashboards** (2–3 days)
  - Request latency, queue depth, worker crash count, DB performance
- **PagerDuty alerts** (1 day)
  - Circuit breaker trip
  - High error rate
  - Queue congestion

---

### ✅ **Phase 3 — Database Improvements & Migration (Week 4–6)**

### **MongoDB Optimization**

- **MongoDB bulk operations (10× faster writes)** (2 days)
- **Database indexing strategy** (1 day)

### **PostgreSQL Migration (Backend-Critical)**

- DB schema design (1 day)
- Write migration pipelines & sync scripts (1–2 days)
- Integrate pgBouncer + pooling strategy (1 day)
- Move read-critical paths to Postgres (1 day)
- Validate data + fallback plan (1 day)

---

### ✅ **Phase 4 — Backend Typing & Internal Contracts (Week 6–7)**

### **Strengthen TypeScript Typing**

- Add **Zod / TypeBox** schemas for all DTOs (1–2 days)
- Implement **end-to-end type safety** (request → service → queue → worker → DB) (2 days)
- Strong typings for:
  - Queue job payloads
  - Repository methods
  - External provider adapters
  - Error classes (`RateLimitError`, `CircuitOpenError`, etc.)

---

### ✅ **Phase 5 — Performance & Cost Optimization (Week 7–8)**

- **Response caching (~20% cost reduction)** (2 days)
- Tune queue throughput & worker autoscaling (1 day)
- Query optimization (1 day)

---

### ⚡ **Phase 6 — Feature Delivery (After Backend Foundations)**

Once the backend is stable, typed, optimized, and instrumented.

- **Authentication (JWT + API Keys)** (3–4 days)
- **Checkpointed run resumes** (2–3 days)
- **WebSocket streaming for live updates** (3–4 days)
- **Add new LLM providers** (Gemini, Mistral, Llama) (2–3 days each)

---

### 🕒 **Total Estimated Duration**

- **Backend foundations:** 6–7 weeks
- **Feature layer:** 2–4 weeks
- **Total:** **2–3 months**

---

### 🎯 Backend Priorities Summary (Top-Down)

1. **Repository revamp** (MongoDB package + typing)
2. **BullMQ + Redis + rate limiting**
3. **Kubernetes scaling configuration**
4. **Observability (OTel + Prom + Grafana + PagerDuty)**
5. **Postgres migration**
6. **Strong typing + schema-level validation**
7. **Performance + caching**
8. **Features**

---

This architecture supports **100k+ prompts/day** with **fault tolerance**, **cost efficiency**, and **horizontal scalability**. Every design decision is backed by systems thinking: caching reduces costs, job queues enable horizontal scaling, bulk operations optimize writes, and comprehensive monitoring prevents surprises.

---

## 📝 License

MIT License - see LICENSE file for details.

Built with [NestJS](https://nestjs.com/) - A progressive Node.js framework.

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
