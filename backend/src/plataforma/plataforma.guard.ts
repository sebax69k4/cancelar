import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { eventoSeguridad } from '../common/security-log';
import type { RolPlataforma } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { sesionVigente, type SessionPayload } from '../auth/sessions';

/** Cookie propia: una sesión de taller nunca sirve en la plataforma, ni al revés. */
export const COOKIE_PLATAFORMA = 'st_plataforma';
/** Sesión completa: 1 hora. La intermedia (falta el segundo factor): 10 minutos. */
export const DURACION_PLATAFORMA_S = 3600;
export const DURACION_SEGUNDO_FACTOR_S = 600;

export type FaseSesion = 'completa' | 'segundo_factor';

export interface SesionPlataforma extends SessionPayload {
  /** distingue estos tokens de los de los talleres */
  k: 'plataforma';
  fase: FaseSesion;
}

export interface CuentaActual {
  id: string;
  nombre: string;
  email: string;
  rol: RolPlataforma;
  /** id de la sesión, para cerrarla */
  jti: string;
  expira: number;
}

type RequestPlataforma = Request & { cuenta?: CuentaActual };

const ROLES = 'rolesPlataforma';
const FASE = 'fasePlataforma';

/** Solo estos roles de plataforma (sin el decorador, cualquiera de los dos). */
export const SoloRol = (...roles: RolPlataforma[]) => SetMetadata(ROLES, roles);
/** La ruta acepta la sesión intermedia, antes de confirmar el segundo factor. */
export const EnSegundoFactor = () => SetMetadata(FASE, 'segundo_factor');

export const Cuenta = createParamDecorator((_: unknown, ctx: ExecutionContext): CuentaActual => {
  const req = ctx.switchToHttp().getRequest<RequestPlataforma>();
  if (!req.cuenta) throw new Error('Cuenta usada fuera de PlataformaGuard');
  return req.cuenta;
});

export function tokenPlataforma(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[COOKIE_PLATAFORMA] ?? null;
}

/** Valida la sesión de plataforma, que la cuenta siga activa y que su rol alcance. */
@Injectable()
export class PlataformaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestPlataforma>();
    const token = tokenPlataforma(req);
    if (!token) throw new UnauthorizedException('Iniciá sesión para continuar');

    let p: SesionPlataforma;
    try {
      p = await this.jwt.verifyAsync<SesionPlataforma>(token);
    } catch {
      throw new UnauthorizedException('La sesión expiró. Volvé a iniciar sesión.');
    }
    const fase = this.reflector.getAllAndOverride<FaseSesion | undefined>(FASE, [ctx.getHandler(), ctx.getClass()]) ?? 'completa';
    if (p.k !== 'plataforma' || p.fase !== fase || !p.jti || !p.exp) throw new UnauthorizedException('La sesión ya no es válida. Volvé a iniciar sesión.');

    const [cuenta, cerrada] = await Promise.all([
      this.prisma.cuentaPlataforma.findUnique({ where: { id: p.sub } }),
      this.prisma.sesionCerrada.findUnique({ where: { jti: p.jti }, select: { jti: true } }),
    ]);
    if (!cuenta?.activo || cerrada || !sesionVigente(p, cuenta.sesionesDesde)) {
      throw new UnauthorizedException('La sesión ya no es válida. Volvé a iniciar sesión.');
    }
    const roles = this.reflector.getAllAndOverride<RolPlataforma[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(cuenta.rol)) {
      eventoSeguridad('plataforma.acceso_denegado', { cuenta: cuenta.id, rol: cuenta.rol, ruta: req.path });
      throw new ForbiddenException('Tu rol de plataforma no permite esta acción');
    }
    req.cuenta = { id: cuenta.id, nombre: cuenta.nombre, email: cuenta.email, rol: cuenta.rol, jti: p.jti, expira: p.exp };
    return true;
  }
}
