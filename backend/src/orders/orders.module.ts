import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Env } from '../config/env';
import { EvidenceStorage } from './evidence.storage';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { UploadGuard } from './upload.guard';

@Module({
  imports: [
    // En memoria: el archivo se escribe a disco recién después de validar permisos
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        storage: memoryStorage(),
        // Un solo archivo y nada más: sin tope, un script mandaba campos de texto de 1 MB sin fin
        limits: {
          fileSize: config.get('UPLOAD_MAX_MB', { infer: true }) * 1024 * 1024,
          files: 1, fields: 0, parts: 1, fieldNameSize: 50, fieldSize: 1024, headerPairs: 20,
        },
      }),
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, EvidenceStorage, UploadGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
