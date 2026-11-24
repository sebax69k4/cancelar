import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Server } from 'node:http';
import { AppModule } from './app.module';
import { SESSION_COOKIE } from './auth/auth.guard';
import type { Env } from './config/env';
import { configureApp } from './setup';

// «Hoy» (fecha estimada, año del número de orden) se calcula en la hora del taller, no en la del
// servidor: los servicios en la nube corren en UTC, 3 h adelante de Argentina. Se cambia con TZ.
process.env.TZ ||= 'America/Argentina/Buenos_Aires';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // La documentación interactiva expone todas las rutas: en producción no se publica
  const docs = process.env.NODE_ENV !== 'production';
  if (docs) {
    const doc = new DocumentBuilder()
      .setTitle('ServicioTécnico API')
      .setDescription('API REST del workflow de reparaciones. Autenticación por cookie HTTP-only (POST /api/auth/login).')
      .setVersion('1.0')
      .addCookieAuth(SESSION_COOKIE)
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  // Un pedido no puede quedar abierto mandando datos de a poco para ocupar un lugar
  const server = app.getHttpServer() as Server;
  server.headersTimeout = 20_000;
  server.requestTimeout = 120_000;
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}/api${docs ? `  ·  Documentación: http://localhost:${port}/api/docs` : ''}`, 'Bootstrap');
}
void bootstrap();
