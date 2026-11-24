import {
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { CurrentUser, RequirePermission, type AuthUser } from '../auth/auth.decorators';
import {
  CommentDto, CreateOrderDto, EscalateDto, OrdersQuery, ReasonDto, ReopenDto, ResolveEscalationDto, TransitionDto, UpdateOrderDto,
} from './orders.dto';
import { OrdersService } from './orders.service';
import { UploadGuard } from './upload.guard';

@ApiTags('órdenes')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** GET /orders?q=&status=&priority=&ownerId= */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: OrdersQuery) {
    return this.orders.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.get(user, id);
  }

  @Post()
  @RequirePermission('order.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  /** Diagnóstico/solución (editar), técnico/responsable (asignar), impacto/urgencia (Supervisor/Admin). */
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orders.update(user, id, dto);
  }

  /** 422 con `details` si no se cumplen las reglas del workflow. */
  @Post(':id/transitions')
  transition(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.orders.transition(user, id, dto);
  }

  @Post(':id/block')
  block(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.orders.block(user, id, dto.motivo);
  }

  @Post(':id/unblock')
  unblock(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.orders.unblock(user, id, dto.comentario);
  }

  @Post(':id/escalate')
  escalate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EscalateDto) {
    return this.orders.escalate(user, id, dto);
  }

  @Post(':id/escalation/take')
  takeEscalation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.takeEscalation(user, id);
  }

  @Post(':id/escalation/raise')
  raiseEscalation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.orders.raiseEscalation(user, id, dto.motivo);
  }

  /** Continuar, en espera, no reparable o rechazado por el cliente. */
  @Post(':id/escalation/resolve')
  resolveEscalation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResolveEscalationDto) {
    return this.orders.resolveEscalation(user, id, dto);
  }

  /** El cliente no retiró el equipo: se cierra como abandonado (solo Admin). */
  @RequirePermission('order.abandon')
  @Post(':id/abandon')
  abandon(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.orders.abandon(user, id, dto.motivo);
  }

  @Post(':id/reopen')
  reopen(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReopenDto) {
    return this.orders.reopen(user, id, dto);
  }

  @Post(':id/validate')
  validate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.orders.validate(user, id, dto.comentario);
  }

  /** Multipart, campo `file`: imagen o PDF, máx. UPLOAD_MAX_MB. */
  @Post(':id/evidence')
  @UseGuards(UploadGuard) // corre antes de leer el archivo
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  addEvidence(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.orders.addEvidence(user, id, file);
  }

  @Delete(':id/evidence/:evidenceId')
  removeEvidence(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('evidenceId') evidenceId: string) {
    return this.orders.removeEvidence(user, id, evidenceId);
  }

  /** Descarga/visualización del archivo de evidencia. */
  @Get(':id/evidence/:evidenceId/file')
  // Aunque algo se colara, el navegador lo abre aislado: sin scripts, formularios ni acceso a la sesión
  @Header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
  @Header('Cache-Control', 'private, no-store')
  async evidenceFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('evidenceId') evidenceId: string) {
    const f = await this.orders.evidenceFile(user, id, evidenceId);
    // Las fotos se ven en el navegador; los PDF se descargan y se abren fuera del sitio
    const modo = f.mime.startsWith('image/') ? 'inline' : 'attachment';
    return new StreamableFile(createReadStream(f.path), {
      type: f.mime,
      disposition: `${modo}; filename*=UTF-8''${encodeURIComponent(f.nombre)}`,
    });
  }
}
