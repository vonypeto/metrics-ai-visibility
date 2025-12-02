import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  LLMVisibilityService,
  CreateRunDto,
  RunSummary,
} from '../repositories/llm-visibility/services/llm-visibility.service';
import type { IRun } from '../repositories/llm-visibility/types/llm-visibility.interfaces';
import { RedisService } from '../libs/redis-module/redis.service';
import { RateLimiterService } from '../libs/rate-limiter-module';

@Controller()
export class LLMVisibilityController {
  private readonly logger = new Logger(LLMVisibilityController.name);

  constructor(
    private readonly llmVisibilityService: LLMVisibilityService,
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  @Post('runs')
  async createRun(@Body() dto: CreateRunDto): Promise<any> {
    this.logger.log(
      `Creating run with ${dto.prompts?.length || 0} prompts, ${dto.brands?.length || 0} brands, ${dto.models?.length || 0} models`,
    );

    try {
      const result = await this.llmVisibilityService.createRun(dto);

      if (result.isNew) {
        this.logger.log(
          `Run created successfully: ${result.run._id}, Status: ${result.run.status}`,
        );
        return {
          run: result.run,
          message:
            'Run created successfully. Processing has started in the background.',
        };
      } else {
        this.logger.log(
          `Returning existing run (idempotent): ${result.run._id}`,
        );
        return {
          run: result.run,
          message:
            'Returning existing run (idempotent). This run was already created.',
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to create run: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || 'Failed to create run',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('runs')
  async listRuns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: IRun[]; total: number; page: number; limit: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    this.logger.debug(`Listing runs: page=${pageNum}, limit=${limitNum}`);

    const result = await this.llmVisibilityService.listRuns(pageNum, limitNum);

    this.logger.debug(
      `Retrieved ${result.data.length} runs out of ${result.total} total`,
    );

    return {
      ...result,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get('runs/:id')
  async getRun(@Param('id') id: string): Promise<IRun> {
    this.logger.debug(`Fetching run: ${id}`);

    const run = await this.llmVisibilityService.getRunById(id);
    if (!run) {
      this.logger.warn(`Run not found: ${id}`);
      throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
    }

    this.logger.debug(`Retrieved run ${id}, status: ${run.status}`);
    return run;
  }

  @Get('runs/:id/summary')
  async getRunSummary(@Param('id') id: string): Promise<RunSummary> {
    this.logger.debug(`Fetching summary for run: ${id}`);

    try {
      const summary = await this.llmVisibilityService.getRunSummary(id);
      this.logger.debug(
        `Retrieved summary for run ${id}: ${summary.brandMetrics?.length || 0} brands, ${summary.promptMetrics?.length || 0} prompts`,
      );
      return summary;
    } catch (error) {
      if ((error as Error).message === 'Run not found') {
        this.logger.warn(`Run not found for summary: ${id}`);
        throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
      }
      this.logger.error(
        `Failed to get run summary for ${id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || 'Failed to get run summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('runs/:id/chat')
  async getRunChat(@Param('id') id: string): Promise<any> {
    this.logger.debug(`Fetching chat view for run: ${id}`);

    try {
      const chat = await this.llmVisibilityService.getRunChat(id);
      this.logger.debug(
        `Retrieved chat for run ${id}: ${chat.conversations?.length || 0} conversations`,
      );
      return chat;
    } catch (error) {
      if ((error as Error).message === 'Run not found') {
        this.logger.warn(`Run not found for chat: ${id}`);
        throw new HttpException('Run not found', HttpStatus.NOT_FOUND);
      }
      this.logger.error(
        `Failed to get run chat for ${id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new HttpException(
        (error as Error).message || 'Failed to get run chat',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async getHealth(): Promise<any> {
    this.logger.debug('Health check requested');

    const redisInfo = await this.redisService.getInfo();
    const rateLimiterStats = this.rateLimiterService.getAllStats();
    const distributedStats = this.rateLimiterService.getDistributedStats();

    const health = {
      status: 'ok',
      redis: redisInfo,
      rateLimiting: {
        distributedEnabled: this.redisService.isRedisConnected(),
        localLimiters: rateLimiterStats,
        distributedLimiters: distributedStats,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(
      `Health check: Redis connected=${this.redisService.isRedisConnected()}, Rate limiting active=${Object.keys(rateLimiterStats).length} limiters`,
    );

    return health;
  }
}
