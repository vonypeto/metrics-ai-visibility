import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Bottleneck from 'bottleneck';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import type Redis from 'ioredis';

interface RateLimiterConfig {
  maxConcurrent: number;
  minTime: number;
  reservoir?: number;
  reservoirRefreshAmount?: number;
  reservoirRefreshInterval?: number;
}

interface DistributedRateLimiterConfig {
  points: number;
  duration: number;
  blockDuration?: number;
  keyPrefix?: string;
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
      return true;
    }

    try {
      await limiter.consume(key);
      return true;
    } catch (error) {
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
    retryCount: number = 0,
    maxRetries: number = 3,
  ): Promise<T> {
    if (this.useDistributed && this.distributedLimiters.has(limiterName)) {
      const allowed = await this.tryConsume(limiterName);
      if (!allowed) {
        if (retryCount >= maxRetries) {
          throw new Error(
            `Rate limit exceeded for ${limiterName} after ${maxRetries} retries`,
          );
        }

        const baseDelay = 1000;
        const maxDelay = 10000;
        const delay = Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);
        const jitter = delay * (0.8 + Math.random() * 0.4);

        if (retryCount % 5 === 0) {
          this.logger.warn(
            `Rate limit exceeded for ${limiterName}, retry ${retryCount + 1}/${maxRetries} after ${Math.round(jitter)}ms`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, jitter));
        return this.scheduleWithDistributedLimit(
          limiterName,
          fn,
          config,
          retryCount + 1,
          maxRetries,
        );
      }
    }

    const limiter = this.getLimiter(limiterName, config);
    return limiter.schedule(() => fn());
  }
  createLimiter(
    name: string,
    config: Partial<RateLimiterConfig> = {},
  ): Bottleneck {
    const defaultConfig: RateLimiterConfig = {
      maxConcurrent: 5,
      minTime: 200,
      ...config,
    };

    const limiter = new Bottleneck({
      maxConcurrent: defaultConfig.maxConcurrent,
      minTime: defaultConfig.minTime,
      reservoir: defaultConfig.reservoir,
      reservoirRefreshAmount: defaultConfig.reservoirRefreshAmount,
      reservoirRefreshInterval: defaultConfig.reservoirRefreshInterval,

      retryLimit: 0,

      trackDoneStatus: true,
    });

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

  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    this.limiters.forEach((limiter, name) => {
      this.logger.log(`Disconnecting rate limiter: ${name}`);
      promises.push(limiter.disconnect());
    });

    await Promise.all(promises);
    this.limiters.clear();
  }

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

  createProviderLimiters(): void {
    this.createLimiter('openai', {
      maxConcurrent: 50,
      minTime: 20,
      reservoir: 100,
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 1000,
    });

    if (this.useDistributed) {
      this.createDistributedLimiter('openai', {
        points: 50,
        duration: 60,
        keyPrefix: 'ratelimit:openai',
      });
    }

    this.createLimiter('anthropic', {
      maxConcurrent: 50,
      minTime: 20,
      reservoir: 100,
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 1000,
    });

    if (this.useDistributed) {
      this.createDistributedLimiter('anthropic', {
        points: 50,
        duration: 60,
        keyPrefix: 'ratelimit:anthropic',
      });
    }

    this.createLimiter('default', {
      maxConcurrent: 5,
      minTime: 200,
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
