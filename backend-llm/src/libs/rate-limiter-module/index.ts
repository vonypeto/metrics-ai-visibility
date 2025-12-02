import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type Redis from 'ioredis';

interface RateLimiterConfig {
  maxConcurrent: number; // Max concurrent requests
  minTime: number; // Min time between requests (ms)
  reservoir?: number; // Initial tokens (for token bucket)
  reservoirRefreshAmount?: number; // Tokens to add per interval
  reservoirRefreshInterval?: number; // Interval for adding tokens (ms)
}

interface DistributedRateLimiterConfig {
  points: number; // Number of requests
  duration: number; // Per duration (seconds)
  blockDuration?: number; // Block duration if exceeded (seconds)
  keyPrefix?: string; // Redis key prefix
}

/**
 * Advanced Rate Limiter Service
 *
 * Provides multiple rate limiting strategies:
 * 1. Local rate limiting (Bottleneck) - per-worker limits
 * 2. Distributed rate limiting (Redis) - shared across all workers
 * 3. Token bucket (burst handling with gradual refill)
 *
 * Uses Redis when available for global rate limiting, falls back to local.
 */
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private limiters: Map<string, Bottleneck> = new Map();
  private distributedLimiters: Map<string, RateLimiterRedis> = new Map();
  private redisClient: Redis | null = null;
  private useDistributed = false;

  /**
   * Initialize with optional Redis client for distributed rate limiting
   */
  initialize(redisClient: Redis | null): void {
    this.redisClient = redisClient;
    this.useDistributed = redisClient !== null;

    if (this.useDistributed) {
      this.logger.log('🚀 Redis-backed distributed rate limiting ENABLED');
    } else {
      this.logger.warn(
        'Redis not available. Using local rate limiting (per-worker limits)',
      );
    }
  }

  async onModuleDestroy() {
    await this.disconnectAll();
  }

  /**
   * Create a distributed rate limiter (Redis-backed)
   * Shared across all workers for global rate limiting
   */
  createDistributedLimiter(
    name: string,
    config: DistributedRateLimiterConfig,
  ): RateLimiterRedis | null {
    if (!this.redisClient) {
      this.logger.warn(
        `Cannot create distributed limiter for ${name}: Redis not available`,
      );
      return null;
    }

    try {
      const limiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: config.keyPrefix || `ratelimit:${name}`,
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration || 0,
      });

      this.distributedLimiters.set(name, limiter);

      this.logger.log(
        `Distributed rate limiter created for ${name}: ${config.points} requests per ${config.duration}s`,
      );

      return limiter;
    } catch (error) {
      this.logger.error(
        `Failed to create distributed limiter for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Consume a rate limit token (for distributed limiting)
   * Returns true if allowed, false if rate limit exceeded
   */
  async tryConsume(
    limiterName: string,
    key: string = 'global',
  ): Promise<boolean> {
    const limiter = this.distributedLimiters.get(limiterName);

    if (!limiter) {
      // No distributed limiter, allow request
      return true;
    }

    try {
      await limiter.consume(key);
      return true;
    } catch (error) {
      // Rate limit exceeded
      this.logger.warn(`Rate limit exceeded for ${limiterName}:${key}`);
      return false;
    }
  }

  /**
   * Schedule with distributed rate limiting
   * Combines local queuing (Bottleneck) with global limits (Redis)
   */
  async scheduleWithDistributedLimit<T>(
    limiterName: string,
    fn: () => Promise<T>,
    config?: Partial<RateLimiterConfig>,
  ): Promise<T> {
    // First check distributed limit
    if (this.useDistributed && this.distributedLimiters.has(limiterName)) {
      const allowed = await this.tryConsume(limiterName);
      if (!allowed) {
        // Wait and retry (simple backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.scheduleWithDistributedLimit(limiterName, fn, config);
      }
    }

    // Then use local limiter for concurrency control
    const limiter = this.getLimiter(limiterName, config);
    return limiter.schedule(() => fn());
  }
  createLimiter(
    name: string,
    config: Partial<RateLimiterConfig> = {},
  ): Bottleneck {
    const defaultConfig: RateLimiterConfig = {
      maxConcurrent: 5,
      minTime: 200, // 5 req/sec default
      ...config,
    };

    const limiter = new Bottleneck({
      maxConcurrent: defaultConfig.maxConcurrent,
      minTime: defaultConfig.minTime,
      reservoir: defaultConfig.reservoir,
      reservoirRefreshAmount: defaultConfig.reservoirRefreshAmount,
      reservoirRefreshInterval: defaultConfig.reservoirRefreshInterval,
      // Enable retries and exponential backoff
      retryLimit: 0, // We handle retries at higher level
      // Track metrics
      trackDoneStatus: true,
    });

    // Log limiter events
    limiter.on('queued', () => {
      this.logger.debug(`Request queued for ${name}`);
    });

    limiter.on('depleted', () => {
      this.logger.warn(`Rate limiter depleted for ${name}`);
    });

    limiter.on('error', (error: Error) => {
      this.logger.error(`Rate limiter error for ${name}: ${error.message}`);
    });

    this.limiters.set(name, limiter);

    this.logger.log(
      `Rate limiter created for ${name}: ${JSON.stringify(defaultConfig)}`,
    );

    return limiter;
  }

  /**
   * Get or create a rate limiter
   */
  getLimiter(name: string, config?: Partial<RateLimiterConfig>): Bottleneck {
    let limiter = this.limiters.get(name);

    if (!limiter) {
      limiter = this.createLimiter(name, config);
    }

    return limiter;
  }

  /**
   * Schedule a function with rate limiting
   */
  async schedule<T>(
    limiterName: string,
    fn: () => Promise<T>,
    config?: Partial<RateLimiterConfig>,
  ): Promise<T> {
    const limiter = this.getLimiter(limiterName, config);
    return limiter.schedule(() => fn());
  }

  /**
   * Get queue statistics for a limiter
   */
  getStats(name: string): {
    running: number;
    queued: number;
    done: number;
  } | null {
    const limiter = this.limiters.get(name);
    if (!limiter) return null;

    return {
      running: limiter.counts().RUNNING,
      queued: limiter.counts().QUEUED,
      done: limiter.counts().DONE ?? 0,
    };
  }

  /**
   * Update limiter configuration dynamically
   */
  updateConfig(name: string, config: Partial<RateLimiterConfig>): void {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      this.logger.warn(`No limiter found for ${name}`);
      return;
    }

    if (config.maxConcurrent !== undefined) {
      limiter.updateSettings({ maxConcurrent: config.maxConcurrent });
    }
    if (config.minTime !== undefined) {
      limiter.updateSettings({ minTime: config.minTime });
    }
    if (config.reservoir !== undefined) {
      limiter.updateSettings({ reservoir: config.reservoir });
    }

    this.logger.log(
      `Rate limiter ${name} config updated: ${JSON.stringify(config)}`,
    );
  }

  /**
   * Stop and disconnect all limiters (cleanup)
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    this.limiters.forEach((limiter, name) => {
      this.logger.log(`Disconnecting rate limiter: ${name}`);
      promises.push(limiter.disconnect());
    });

    await Promise.all(promises);
    this.limiters.clear();
  }

  /**
   * Get all limiters status
   */
  getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.limiters.forEach((limiter, name) => {
      stats[name] = {
        running: limiter.counts().RUNNING,
        queued: limiter.counts().QUEUED,
        done: limiter.counts().DONE ?? 0,
      };
    });

    return stats;
  }

  /**
   * Create provider-specific rate limiters based on known limits
   * Creates both local (concurrency) and distributed (global rate) limiters
   */
  createProviderLimiters(): void {
    // OpenAI rate limits (adjust based on tier)
    this.createLimiter('openai', {
      maxConcurrent: 50,
      minTime: 20, // 50 req/sec for high tier
      reservoir: 100, // Burst capacity
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 1000, // Refill 50 tokens per second
    });

    // Distributed rate limiter for OpenAI (shared across workers)
    if (this.useDistributed) {
      this.createDistributedLimiter('openai', {
        points: 50000, // 50k requests per minute (tier 5)
        duration: 60, // per 60 seconds
        keyPrefix: 'ratelimit:openai',
      });
    }

    // Anthropic rate limits
    this.createLimiter('anthropic', {
      maxConcurrent: 50,
      minTime: 20, // Similar to OpenAI
      reservoir: 100,
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 1000,
    });

    // Distributed rate limiter for Anthropic
    if (this.useDistributed) {
      this.createDistributedLimiter('anthropic', {
        points: 50000, // 50k requests per minute
        duration: 60,
        keyPrefix: 'ratelimit:anthropic',
      });
    }

    // Conservative default for unknown providers
    this.createLimiter('default', {
      maxConcurrent: 5,
      minTime: 200, // 5 req/sec
    });

    this.logger.log(
      `Provider rate limiters initialized (distributed: ${this.useDistributed})`,
    );
  }

  /**
   * Get distributed limiter stats
   */
  getDistributedStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.distributedLimiters.forEach((_, name) => {
      stats[name] = {
        type: 'distributed',
        redis: this.useDistributed,
      };
    });

    return stats;
  }
}
