import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Límite de solicitudes por IP. En el login se cuenta por IP + email: en un taller
 * varias PCs suelen compartir la misma IP pública, y contar solo por IP bloquearía
 * al sexto empleado que inicia sesión en el mismo minuto.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = typeof req.ip === 'string' ? req.ip : 'sin-ip';
    const path = typeof req.path === 'string' ? req.path : '';
    if (path.endsWith('/auth/login') || path.endsWith('/plataforma/login')) {
      const body = req.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      return Promise.resolve(`${ip}|${email}`);
    }
    return Promise.resolve(ip);
  }
}
