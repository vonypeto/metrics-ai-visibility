# Redis Keys Reference

## What's Stored in Redis

Your Redis instance stores distributed rate limiting state shared across all worker processes.

### Rate Limiter Keys

#### Pattern: `ratelimit:{provider}:global`

These keys track the global rate limit consumption for each LLM provider.

**Current Keys:**

```
ratelimit:openai:global    - OpenAI global rate limit counter
ratelimit:anthropic:global - Anthropic global rate limit counter (created on first use)
```

**Structure:**

- **Type**: Hash
- **Fields**:
  - `points`: Remaining request tokens
  - `expire`: Expiration timestamp

**Configuration:**

```typescript
OpenAI: {
  points: 50000,     // 50k requests per minute
  duration: 60,      // per 60 seconds
  keyPrefix: 'ratelimit:openai'
}

Anthropic: {
  points: 50000,     // 50k requests per minute
  duration: 60,      // per 60 seconds
  keyPrefix: 'ratelimit:anthropic'
}
```

### How It Works

1. **Request Arrives**: Worker wants to call OpenAI API
2. **Check Global Limit**:
   ```typescript
   await rateLimiter.tryConsume("openai", "global");
   ```
3. **Redis Operation**:
   - Decrements `ratelimit:openai:global` counter
   - If counter > 0: Request allowed ✅
   - If counter = 0: Request blocked ❌ (wait 1s, retry)
4. **Auto-Refill**: Counter refills to 50,000 every 60 seconds

### Benefits

✅ **Shared Limits**: All workers share the same quota  
✅ **No Over-consumption**: Can't exceed provider limits even with 10 workers  
✅ **Automatic**: No manual coordination needed  
✅ **Fast**: Redis operations are < 1ms

### Monitoring

Check current rate limit status:

```bash
# Connect to Redis
redis-cli -u rediss://default:your_redis_password@your_redis_host:your_redis_port

# List all keys
KEYS ratelimit:*

# Check OpenAI rate limit
GET ratelimit:openai:global

# Check TTL
TTL ratelimit:openai:global
```

Check via API:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "enabled": true,
    "usedMemory": "1.2M",
    "connectedClients": "1"
  },
  "rateLimiting": {
    "mode": "distributed",
    "local": {
      "openai": { "running": 2, "queued": 0, "done": 15 }
    },
    "distributed": {
      "openai": { "type": "distributed", "redis": true }
    }
  }
}
```

### Architecture

```
Worker 1 ──┐
Worker 2 ──┼──> Redis (ratelimit:openai:global) ──> Shared Counter
Worker 3 ──┘                                          (50,000 / min)

All workers decrement same counter
= Global rate limiting ✅
```

**Without Redis:**

```
Worker 1 ──> Local Counter (50k/min) ┐
Worker 2 ──> Local Counter (50k/min) ├──> Total: 150k/min ❌
Worker 3 ──> Local Counter (50k/min) ┘    (Exceeds provider limit!)
```

### Key Lifecycle

1. **Creation**: First request creates key
2. **Consumption**: Each request decrements counter
3. **Refill**: Counter resets to max every 60s
4. **Expiration**: Key auto-expires after duration
5. **Recreation**: Next request recreates key

### Cleanup

Redis keys are self-cleaning (auto-expire). No manual cleanup needed!

If you want to reset limits manually:

```bash
redis-cli -u YOUR_REDIS_URL
DEL ratelimit:openai:global
DEL ratelimit:anthropic:global
```

---

## Summary

**Do you need these keys?**

✅ **YES!** These keys enable distributed rate limiting.

**What they do:**

- Prevent over-consumption of provider quotas
- Share limits across multiple workers
- Ensure you stay within OpenAI/Anthropic rate limits

**Storage Cost:**

- ~1KB per provider
- Auto-expire (no buildup)
- Negligible storage impact

**Status:** ✅ Working correctly - your distributed rate limiting is active!
