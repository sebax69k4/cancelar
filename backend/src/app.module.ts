import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppThrottlerGuard } from './common/app-throttler.guard';
import { textoSeguro } from './common/safe-text';
import { CatalogController } from './catalog/catalog.controller';
import { ClientsModule } from './clients/clients.module';
import { validateEnv } from './config/env';
import { DashboardModule } from './dashboard/dashboard.module';
import { EquipmentModule } from './equipment/equipment.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { PlataformaModule } from './plataforma/plataforma.module';
import { PrismaModule } from './prisma/prisma.module';
import { SetupModule } from './setup/setup.module';

const porIp = (req: Record<string, unknown>) => (typeof req.ip === 'string' ? req.ip : 'sin-ip');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Límite general: 600 requests/min por IP. Holgado a propósito: en un taller varias PCs comparten
    // la IP pública y el frontend precarga datos. El login tiene su propio límite (por IP + email).
    // «ip» cuenta solo por IP, sin importar el email: frena a quien prueba una contraseña contra muchas
    // cuentas. Fuera del login el límite es inalcanzable (cada ruta lo ajusta con @Throttle).
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 600 },
      { name: 'ip', ttl: 60_000, limit: 1_000_000, getTracker: porIp },
      // «hora»: topes por hora por IP (ej. registro de talleres); inalcanzable en las demás rutas
      { name: 'hora', ttl: 3_600_000, limit: 1_000_000, getTracker: porIp },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ClientsModule,
    EquipmentModule,
    OrdersModule,
    DashboardModule,
    SetupModule,
    PlataformaModule,
  ],
  controllers: [HealthController, CatalogController],
  // El ThrottlerGuard va antes que el AuthGuard (registrado en AuthModule)
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(textoSeguro).forRoutes('*path'); // corre con el cuerpo ya leído
  }
}
