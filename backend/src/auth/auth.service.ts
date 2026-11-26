import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TALLER_SUSPENDIDO } from './auth.guard';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eventoSeguridad, ocultarEmail } from '../common/security-log';
import { SERVICIOS_INICIALES } from '../domain/servicios';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { toUsuario } from '../common/mappers';
import { corteDeSesiones, nuevaSesion, type SessionPayload } from './sessions';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto, RegisterDto } from '../setup/setup.dto';

@Injectable()
export class AuthService {
  /** Hash real de una contraseña descartable: si el email no existe se verifica contra él,
   *  así el tiempo de respuesta no revela qué emails existen. */
  private readonly dummyHash = argon2.hash('usuario-inexistente');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.usuario.findUnique({ where: { email: email.toLowerCase() }, include: { taller: { select: { suspendido: true } } } });
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!user || !user.activo || !ok) {
      eventoSeguridad('login.fallido', { ip, email: ocultarEmail(email), motivo: !user ? 'email' : !ok ? 'clave' : 'inactivo' });
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    if (user.taller.suspendido) {
      eventoSeguridad('login.taller_suspendido', { ip, usuario: user.id, taller: user.tallerId });
      throw new ForbiddenException(TALLER_SUSPENDIDO);
    }
    eventoSeguridad('login.ok', { ip, usuario: user.id, taller: user.tallerId }, 'log');
    return { token: await this.jwt.signAsync(nuevaSesion(user.id)), user: toUsuario(user) };
  }

  /** Taller nuevo: crea el taller, su Admin y los servicios iniciales. Las demás personas las crea el Admin. */
  async register(dto: RegisterDto, ip?: string) {
    const passwordHash = await argon2.hash(dto.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        if (await tx.usuario.findUnique({ where: { email: dto.email } })) throw new ConflictException('Ese email ya está en uso');
        const taller = await tx.taller.create({ data: { nombre: dto.tallerNombre } });
        await tx.servicio.createMany({ data: SERVICIOS_INICIALES.map((s) => ({ ...s, tallerId: taller.id })) });
        return tx.usuario.create({ data: { tallerId: taller.id, nombre: dto.nombre, email: dto.email, passwordHash, roles: ['ADMIN'] } });
      });
      eventoSeguridad('taller.registrado', { ip, usuario: user.id, taller: user.tallerId }, 'log');
      return { token: await this.jwt.signAsync(nuevaSesion(user.id)), user: toUsuario(user) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese email ya está en uso');
      }
      throw e;
    }
  }

  /** Cambia la contraseña, cierra las demás sesiones y devuelve un token nuevo para la actual. */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<string> {
    const user = await this.prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
    const ok = await argon2.verify(user.passwordHash, dto.actual).catch(() => false);
    if (!ok) {
      eventoSeguridad('password.actual_incorrecta', { usuario: userId });
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    if (dto.nueva === dto.actual) throw new BadRequestException('La contraseña nueva tiene que ser distinta de la actual');
    await this.prisma.usuario.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(dto.nueva), sesionesDesde: corteDeSesiones() } });
    eventoSeguridad('password.cambiada', { usuario: userId }, 'log');
    return this.jwt.signAsync(nuevaSesion(userId));
  }

  /**
   * Cerrar sesión: además de borrar la cookie, anota el token como cerrado. Si alguien lo
   * hubiera copiado, deja de servirle en ese momento y no recién cuando vence.
   */
  async logout(token: string | null, ip?: string): Promise<void> {
    if (!token) return;
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      return; // vencido o inválido: ya no sirve para nada
    }
    if (!payload.jti || !payload.exp) return;
    await this.prisma.sesionCerrada.upsert({
      where: { jti: payload.jti },
      update: {},
      create: { jti: payload.jti, expira: new Date(payload.exp * 1000) },
    });
    eventoSeguridad('logout', { ip, usuario: payload.sub }, 'log');
  }

  /** Las sesiones cerradas solo hace falta recordarlas hasta que el token vence igual. */
  @Cron(CronExpression.EVERY_HOUR)
  async limpiarSesionesCerradas(): Promise<number> {
    return (await this.prisma.sesionCerrada.deleteMany({ where: { expira: { lt: new Date() } } })).count;
  }
}
