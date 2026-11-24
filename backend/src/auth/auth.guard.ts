import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { eventoSeguridad } from '../common/security-log';
import { can, type Permission } from '../domain/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC, PERMISSIONS, type AuthedRequest } from './auth.decorators';
import { sesionVigente, type SessionPayload } from './sessions';

export const SESSION_COOKIE = 'st_session';

/** Token de la request: la cookie de sesión o, para clientes que no son el navegador, «Bearer». */
export function extraerToken(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const fromCookie = cookies?.[SESSION_COOKIE];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Guard global: valida la cookie de sesión (o Bearer) y los permisos de la ruta. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = extraerToken(req);
    if (!token) throw new UnauthorizedException('Iniciá sesión para continuar');

    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch (e) {
      // Vencido es lo normal; una firma inválida o un algoritmo distinto es un token armado a mano
      if ((e as { name?: unknown }).name !== 'TokenExpiredError') {
        eventoSeguridad('token.invalido', { ip: req.ip, ruta: req.path });
      }
      throw new UnauthorizedException('La sesión expiró. Volvé a iniciar sesión.');
    }

    const [user, cerrada] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { id: true, nombre: true, email: true, roles: true, activo: true, tallerId: true, sesionesDesde: true },
      }),
      payload.jti ? this.prisma.sesionCerrada.findUnique({ where: { jti: payload.jti }, select: { jti: true } }) : null,
    ]);
    if (!user || !user.activo) throw new UnauthorizedException('Usuario inexistente o inactivo');
    if (cerrada) {
      eventoSeguridad('token.cerrado_reusado', { ip: req.ip, usuario: user.id, ruta: req.path });
      throw new UnauthorizedException('La sesión ya no es válida. Volvé a iniciar sesión.');
    }
    if (!sesionVigente(payload, user.sesionesDesde)) throw new UnauthorizedException('La sesión ya no es válida. Volvé a iniciar sesión.');
    req.user = { id: user.id, nombre: user.nombre, email: user.email, roles: user.roles, tallerId: user.tallerId };

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS, targets);
    if (required?.length && !required.some((p) => can(user.roles, p))) {
      throw new ForbiddenException('Tu rol no tiene permiso para esta acción');
    }
    return true;
  }
}
