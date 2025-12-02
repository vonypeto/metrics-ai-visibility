import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common/services/logger.service';
import * as dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cors());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`🚀 'RPC' server is running: http://0.0.0.0:${port}/`);
}

bootstrap().catch((error) => {
  Logger.error('Failed to start application', error);
  process.exit(1);
});
