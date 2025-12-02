import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from './libs/nestjs-config-module/src';
// import { HackerOneModule } from './repositories/hackerone/hackerone.module';
// import { HackerOneController } from './api/hackerone.controller';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './controller/app.controller';
import { AppService } from './app.service';
import { LLMVisibilityModule } from './repositories/llm-visibility/llm-visibility.module';
// import { WappalyzerController } from './api/wappalyzer.controller';
// import { WappalyzerModule } from './libs/wappalyzer/wappalyzer.module';

@Module({
  imports: [
    // HackerOneModule,
    ConfigModule.forRoot(),
    HttpModule,
    LLMVisibilityModule,
    // WappalyzerModule,
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.getString('BACKEND_LLM_DATABASE_URI'),
        minPoolSize: Math.floor(
          (config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10) *
            0.4,
        ),
        maxPoolSize:
          config.getNumber('MONGODB_POOL_SIZE', { optional: true }) ?? 10,
        socketTimeoutMS: 60000,
        heartbeatFrequencyMS: 2000,
        serverSelectionTimeoutMS: 30000,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
