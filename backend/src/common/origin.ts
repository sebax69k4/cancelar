import type { NextFunction, Request, Response } from 'express';
import { eventoSeguridad } from './security-log';

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa contra CSRF: la cookie de sesión viaja sola, así que otra página abierta en el mismo
 * navegador podría mandar un POST en nombre de la persona. SameSite=Lax frena a los sitios de
 * otro dominio, pero no a otro puerto o subdominio del mismo sitio. Por eso todo lo que modifica
 * datos tiene que venir del frontend (CORS_ORIGIN) o de la propia API.
 * Los navegadores siempre mandan `Origin` en esos métodos; sin `Origin` (curl, apps, pruebas)
 * no hay cookie ajena que aprovechar, salvo que `Sec-Fetch-Site` diga que viene de otro sitio.
 */
export function origenPermitido(permitidos: readonly string[]) {
  const lista = new Set(permitidos);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (SEGUROS.has(req.method)) return next();
    const origin = req.headers.origin;
    const propio = `${req.protocol}://${req.headers.host ?? ''}`;
    const rechazar = origin !== undefined ? !lista.has(origin) && origin !== propio : req.headers['sec-fetch-site'] === 'cross-site';
    if (rechazar) {
      eventoSeguridad('origen.rechazado', { ip: req.ip, metodo: req.method, ruta: req.path, origen: origin ?? 'cross-site' });
      res.status(403).json({ statusCode: 403, message: 'Solicitud bloqueada: no viene del sistema' });
      return;
    }
    next();
  };
}
