import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { tokens } from './types/tokens';
import {
  RunSchema,
  PromptSchema,
  BrandSchema,
  ResponseSchema,
  BrandMentionSchema,
} from './schemas';
import {
  RunRepository,
  PromptRepository,
  BrandRepository,
  ResponseRepository,
  BrandMentionRepository,
} from './llm-visibility.repositories';
import { LLMProviderService } from './services/llm-provider.service';
import { LLMVisibilityService } from './services/llm-visibility.service';
import { LLMVisibilityController } from '../../controller/llm-visibility.controller';
import { CircuitBreakerService } from '../../libs/circuit-breaker-module';
import { RateLimiterService } from '../../libs/rate-limiter-module';
import { RedisService } from '../../libs/redis-module/redis.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: tokens.Run, schema: RunSchema },
      { name: tokens.Prompt, schema: PromptSchema },
      { name: tokens.Brand, schema: BrandSchema },
      { name: tokens.Response, schema: ResponseSchema },
      { name: tokens.BrandMention, schema: BrandMentionSchema },
    ]),
  ],
  controllers: [LLMVisibilityController],
  providers: [
    RunRepository,
    PromptRepository,
    BrandRepository,
    ResponseRepository,
    BrandMentionRepository,
    RedisService,
    CircuitBreakerService,
    RateLimiterService,
    LLMProviderService,
    LLMVisibilityService,
  ],
  exports: [LLMVisibilityService, RedisService],
})
export class LLMVisibilityModule implements OnModuleInit {
  constructor(
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  onModuleInit() {
    // Initialize rate limiter with Redis client
    const redisClient = this.redisService.getClient();
    this.rateLimiterService.initialize(redisClient);
    this.rateLimiterService.createProviderLimiters();
  }
}
