import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { limiteCuerpo } from './common/body-limit';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { origenPermitido } from './common/origin';
import type { Env } from './config/env';

/** Configuración común a main.ts y a los tests e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix('api');
  // Detrás de un proxy: la IP real del cliente (límites de login, registro de seguridad)
  const proxies = config.get('TRUST_PROXY', { infer: true });
  if (proxies > 0) (app.getHttpAdapter().getInstance() as { set(k: string, v: number): void }).set('trust proxy', proxies);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  const origins = config.get('CORS_ORIGIN', { infer: true }).split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.use(origenPermitido(origins)); // CSRF: lo que modifica datos tiene que venir del frontend
  // Antes de leer ningún cuerpo: un pedido gigante se corta sin recibirlo entero
  app.use(limiteCuerpo(config.get('UPLOAD_MAX_MB', { infer: true })));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: true }));
  app.useGlobalFilters(new ApiExceptionFilter(config.get('UPLOAD_MAX_MB', { infer: true })));
  app.enableShutdownHooks();
}
