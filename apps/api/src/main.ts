import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MetricsService } from './modules/common/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(...[]);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI-Native Chat API')
    .setDescription('AI-Native Chat System with DeepSeek Agent')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  app.getHttpAdapter().get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.getHttpAdapter().get('/metrics', (_, res) => {
    const metrics = app.get(MetricsService);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics.export());
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.warn(`Application is running on: http://localhost:${port}`);
  console.warn(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
