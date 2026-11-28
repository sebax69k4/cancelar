import type { NextFunction, Request, Response } from 'express';

/**
 * El limitador de @nestjs/throttler agrega cabeceras X-RateLimit-* con los umbrales (cuántos
 * pedidos por minuto, el cupo por hora, cuántos quedan). Eso le dice a un atacante exactamente
 * cuánto puede intentar antes de que lo frenen, así que se quitan de la respuesta.
 *
 * `Retry-After` sí se conserva: en un 429 es estándar y legítimo para que un cliente sepa
 * cuándo reintentar, y no revela el umbral.
 */
export function ocultarLimites(_req: Request, res: Response, next: NextFunction): void {
  const setHeader = res.setHeader.bind(res);
  res.setHeader = ((nombre: string, valor: Parameters<Response['setHeader']>[1]) => {
    if (nombre.toLowerCase().startsWith('x-ratelimit')) return res;
    return setHeader(nombre, valor);
  }) as Response['setHeader'];
  next();
}
