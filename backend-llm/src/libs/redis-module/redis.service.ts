import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '../nestjs-config-module/src';
import Redis from 'ioredis';

/**
 * Redis Service
 *
 * Manages Redis connection for distributed rate limiting and caching.
 * Uses ioredis for robust Redis client with automatic reconnection.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    const redisUri = this.configService.getString('REDIS_URI', {
      optional: true,
    });

    if (!redisUri) {
      this.logger.warn(
        'REDIS_URI not configured. Redis features (distributed rate limiting) will be disabled.',
      );
      return;
    }

    try {
      this.logger.log('Connecting to Redis...');

      this.client = new Redis(redisUri, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err) => {
          this.logger.error(`Redis connection error: ${err.message}`);
          return true; // Reconnect
        },
      });

      // Event handlers
      this.client.on('connect', () => {
        this.logger.log('Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.logger.log('Redis ready');
      });

      this.client.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        this.logger.log('Redis reconnecting...');
      });

      // Wait for connection
      await this.client.ping();
      this.logger.log('Redis connection verified');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.client = null;
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      this.logger.log('Disconnecting from Redis...');
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Get the Redis client
   */
  getClient(): Redis | null {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get Redis info for monitoring
   */
  async getInfo(): Promise<Record<string, any>> {
    if (!this.client) {
      return {
        connected: false,
        reason: 'Redis not configured',
      };
    }

    try {
      const info = await this.client.info();
      const [usedMemory] = info.match(/used_memory_human:(.+)/) || [];
      const [connectedClients] = info.match(/connected_clients:(\d+)/) || [];

      return {
        connected: this.isConnected,
        usedMemory: usedMemory?.split(':')[1]?.trim(),
        connectedClients: connectedClients?.split(':')[1]?.trim(),
        version: await this.client.info('server'),
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
