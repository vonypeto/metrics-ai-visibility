# Docker Setup Guide

## Quick Start

1. **Copy environment file and add your API keys:**

   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY and/or ANTHROPIC_API_KEY
   ```

2. **Build and start all services:**

   ```bash
   docker compose up -d --build
   ```

3. **Access the services:**
   - Frontend: http://localhost:80
   - Backend API: http://localhost:3000
   - RedisInsight: http://localhost:5540
   - MongoDB: localhost:27017

## Services

### Backend (NestJS API)

- **Container:** backend-llm-api
- **Port:** 3000
- **Healthcheck:** Automatic monitoring
- **Environment:** Production-optimized Node.js

### Frontend (React App)

- **Container:** frontend-llm-app
- **Port:** 80
- **Server:** Nginx with optimized config
- **Features:** Gzip compression, caching, security headers

### MongoDB

- **Container:** backend-llm-mongo
- **Port:** 27017
- **Credentials:** root/password (change in production!)
- **Volume:** Persistent data storage

### Redis

- **Container:** backend-llm-redis
- **Port:** 6379
- **Config:** 512MB max memory with LRU eviction
- **Volume:** Persistent data storage

### RedisInsight

- **Container:** redis-insight
- **Port:** 5540
- **Purpose:** GUI for Redis monitoring

## Common Commands

### Start all services

```bash
docker compose up -d
```

### Stop all services

```bash
docker compose down
```

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Rebuild after code changes

```bash
docker compose up -d --build
```

### Stop and remove all data (⚠️ destroys volumes)

```bash
docker compose down -v
```

### Check service status

```bash
docker compose ps
```

### Execute commands in containers

```bash
# Backend CLI
docker compose exec backend node cli.js list-runs

# MongoDB shell
docker compose exec mongodb mongosh -u root -p password

# Redis CLI
docker compose exec redis redis-cli
```

## Development Mode

For development with hot-reload, use the dev setup instead:

### Backend Development

```bash
cd backend-llm
pnpm install
pnpm start:dev
```

### Frontend Development

```bash
cd frontend-llm
npm install
npm start
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs

# Restart services
docker compose restart
```

### Port already in use

Edit `docker-compose.yml` and change the host port:

```yaml
ports:
  - "3001:3000" # Use 3001 instead of 3000
```

### Out of memory

Increase Docker's memory limit in Docker Desktop settings or edit Redis maxmemory:

```yaml
command: ["redis-server", "--maxmemory", "1gb"]
```

### Reset everything

```bash
docker compose down -v
docker system prune -a
docker compose up -d --build
```

## Production Considerations

1. **Change default credentials** in docker-compose.yml
2. **Use Docker secrets** for API keys
3. **Set up reverse proxy** (nginx/traefik) for SSL
4. **Configure backups** for MongoDB volume
5. **Monitor resource usage** and adjust limits
6. **Use specific image tags** instead of `latest`
7. **Enable log rotation** to prevent disk fill

## Network Architecture

All services run on the `llm-network` bridge network, allowing:

- Internal DNS resolution (e.g., `mongodb:27017`)
- Service isolation from host network
- Efficient inter-container communication

## Health Checks

All critical services have health checks:

- **Backend:** HTTP endpoint check every 30s
- **Frontend:** Nginx availability check
- **MongoDB:** Database ping every 10s
- **Redis:** Redis CLI ping every 10s

Services wait for dependencies to be healthy before starting.
