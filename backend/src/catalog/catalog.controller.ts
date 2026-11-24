import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { toPersona, toServicio } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

/** Catálogos de solo lectura: usuarios asignables y servicios. */
@ApiTags('catálogos')
@Controller()
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /users — usuarios activos (para asignar responsable y técnico). */
  @Get('users')
  async users(@CurrentUser() user: AuthUser) {
    const list = await this.prisma.usuario.findMany({ where: { tallerId: user.tallerId, activo: true }, orderBy: { nombre: 'asc' } });
    return list.map(toPersona);
  }

  /** GET /services — catálogo de servicios activos. */
  @Get('services')
  async services(@CurrentUser() user: AuthUser) {
    const list = await this.prisma.servicio.findMany({ where: { tallerId: user.tallerId, activo: true }, orderBy: { nombre: 'asc' } });
    return list.map(toServicio);
  }
}
