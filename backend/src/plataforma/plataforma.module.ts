import { Module } from '@nestjs/common';
import { PlataformaController } from './plataforma.controller';
import { PlataformaGuard } from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

/** Moderador y Administrador de plataforma: por encima de los talleres, con sesión y segundo factor propios. */
@Module({
  controllers: [PlataformaController],
  providers: [PlataformaService, PlataformaGuard],
})
export class PlataformaModule {}
