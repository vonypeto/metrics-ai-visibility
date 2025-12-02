# NestJS Config Module

This module is a simple and powerful tool for managing configurations in NestJS applications. It centralizes your app's settings and makes it easy to handle different configurations for various environments like development, testing, and production.

## Usage

Import the `ConfigModule` in your `AppModule`:

```ts
import { ConfigModule } from 'nestjs-config';

@Module({
  imports: [ConfigModule.forRoot()],
})
export class AppModule {}
```

Access configuration settings in your services:

```ts
import { ConfigService } from 'nestjs-config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    const appName = this.configService.get('APP_NAME');
    return `Hello from ${appName}!`;
  }
}
```
