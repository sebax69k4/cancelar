import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth/auth.decorators';
import { WorkflowException } from '../common/errors';
import { toServicio } from '../common/mappers';
import type { Env } from '../config/env';
import { ROL_LABEL } from '../domain/labels';
import { rolesFaltantes } from '../domain/setup';
import type { Servicio, Usuario } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { corteDeSesiones } from '../auth/sessions';
import { PrismaService } from '../prisma/prisma.service';
import { eventoSeguridad } from '../common/security-log';
import type { CreateServiceDto, CreateUserDto, UpdateServiceDto, UpdateTallerDto, UpdateUserDto } from './setup.dto';

const toUsuarioAdmin = (u: Usuario) => ({ id: u.id, nombre: u.nombre, email: u.email, roles: u.roles, activo: u.activo });
const toServicioAdmin = (s: Servicio) => ({ ...toServicio(s), activo: s.activo });

/** Configuración de cada taller. Todo se limita al taller del usuario que pide. */
@Injectable()
export class SetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Público: para la portada y el registro. */
  async status() {
    // Solo si hay alguno (para llevar al registro en una instalación nueva): cuántos son no es público
    const hayTalleres = (await this.prisma.taller.findFirst({ select: { id: true } })) !== null;
    return { hayTalleres, registroAbierto: true };
  }

  /** El taller del usuario: si ya terminó la configuración inicial. */
  async mine(user: AuthUser) {
    const taller = await this.prisma.taller.findUniqueOrThrow({ where: { id: user.tallerId } });
    return { configurado: taller.configurado, tallerNombre: taller.nombre };
  }

  /** Roles esenciales sin nadie activo en el taller. */
  async rolesFaltantes(tallerId: number) {
    return rolesFaltantes(await this.prisma.usuario.findMany({ where: { tallerId }, select: { roles: true, activo: true } }));
  }

  async progress(user: AuthUser) {
    const [taller, faltan, servicios] = await Promise.all([
      this.prisma.taller.findUnique({ where: { id: user.tallerId } }),
      this.rolesFaltantes(user.tallerId),
      this.prisma.servicio.count({ where: { tallerId: user.tallerId, activo: true } }),
    ]);
    if (!taller) throw new NotFoundException('El taller no existe');
    return {
      taller: { nombre: taller.nombre, telefono: taller.telefono, direccion: taller.direccion },
      configurado: taller.configurado,
      rolesFaltantes: faltan,
      serviciosActivos: servicios,
    };
  }

  async updateTaller(user: AuthUser, dto: UpdateTallerDto) {
    await this.prisma.taller.update({
      where: { id: user.tallerId },
      data: { nombre: dto.nombre, telefono: dto.telefono || null, direccion: dto.direccion || null },
    });
    return this.progress(user);
  }

  async complete(user: AuthUser) {
    const p = await this.progress(user);
    const missing = p.rolesFaltantes.map((r) => `Falta una persona con el rol ${ROL_LABEL[r]}`);
    if (p.serviciosActivos === 0) missing.push('Falta al menos un servicio activo');
    if (missing.length) throw new WorkflowException('Todavía no se puede terminar la configuración', missing);
    await this.prisma.taller.update({ where: { id: user.tallerId }, data: { configurado: true } });
    return this.progress(user);
  }

  // ------------------------------------------------------------------ usuarios

  async listUsers(user: AuthUser) {
    const list = await this.prisma.usuario.findMany({ where: { tallerId: user.tallerId }, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] });
    return list.map(toUsuarioAdmin);
  }

  async createUser(user: AuthUser, dto: CreateUserDto) {
    try {
      const u = await this.prisma.usuario.create({
        data: {
          tallerId: user.tallerId,
          nombre: dto.nombre,
          email: dto.email,
          roles: dto.roles,
          passwordHash: await argon2.hash(dto.password),
        },
      });
      eventoSeguridad('usuario.creado', { actor: user.id, usuario: u.id, taller: user.tallerId, roles: dto.roles.join(',') }, 'log');
      return toUsuarioAdmin(u);
    } catch (e) {
      // El email es único en todo el sistema: con él se ingresa
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese email ya está en uso');
      }
      throw e;
    }
  }

  updateUser(actor: AuthUser, id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.findFirst({ where: { id, tallerId: actor.tallerId } });
      if (!u) throw new NotFoundException('El usuario no existe');
      if (dto.activo === false && id === actor.id) throw new BadRequestException('No podés desactivar tu propio usuario');

      const dejaDeSerAdmin = u.roles.includes('ADMIN') && u.activo && (dto.activo === false || (dto.roles && !dto.roles.includes('ADMIN')));
      if (dejaDeSerAdmin) {
        const otros = await tx.usuario.count({
          where: { tallerId: actor.tallerId, id: { not: id }, activo: true, roles: { has: 'ADMIN' } },
        });
        if (otros === 0) throw new WorkflowException('Tiene que quedar al menos un Admin activo');
      }
      const data: Prisma.UsuarioUpdateInput = { nombre: dto.nombre, roles: dto.roles, activo: dto.activo };
      if (dto.password) data.passwordHash = await argon2.hash(dto.password);
      // Reseteo de contraseña o desactivación: las sesiones abiertas de esa persona dejan de valer
      if (dto.password || dto.activo === false) data.sesionesDesde = corteDeSesiones();
      const actualizado = await tx.usuario.update({ where: { id }, data });
      eventoSeguridad('usuario.modificado', {
        actor: actor.id, usuario: id, taller: actor.tallerId,
        roles: dto.roles?.join(','), activo: dto.activo, claveReseteada: dto.password ? true : undefined,
      }, 'log');
      return toUsuarioAdmin(actualizado);
    });
  }

  // ------------------------------------------------------------------ servicios

  async listServices(user: AuthUser) {
    const list = await this.prisma.servicio.findMany({ where: { tallerId: user.tallerId }, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] });
    return list.map(toServicioAdmin);
  }

  /** Dos servicios del mismo taller no pueden llamarse igual (sin importar mayúsculas). */
  private async assertNombreServicioLibre(tallerId: number, nombre: string, exceptoId?: string) {
    const dup = await this.prisma.servicio.findFirst({
      where: { tallerId, nombre: { equals: nombre, mode: 'insensitive' }, ...(exceptoId ? { id: { not: exceptoId } } : {}) },
    });
    if (dup) throw new ConflictException(`Ya existe el servicio «${dup.nombre}»`);
  }

  async createService(user: AuthUser, dto: CreateServiceDto) {
    await this.assertNombreServicioLibre(user.tallerId, dto.nombre);
    const s = await this.prisma.servicio.create({
      data: {
        tallerId: user.tallerId,
        codigo: randomUUID().slice(0, 8).toUpperCase(),
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? '',
        precioBase: dto.precioBase,
      },
    });
    return toServicioAdmin(s);
  }

  async updateService(user: AuthUser, id: string, dto: UpdateServiceDto) {
    const s = await this.prisma.servicio.findFirst({ where: { id, tallerId: user.tallerId } });
    if (!s) throw new NotFoundException('El servicio no existe');
    if (dto.nombre !== undefined) await this.assertNombreServicioLibre(user.tallerId, dto.nombre, id);
    return toServicioAdmin(await this.prisma.servicio.update({ where: { id }, data: dto }));
  }
}
