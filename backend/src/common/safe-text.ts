import type { NextFunction, Request, Response } from 'express';
import { eventoSeguridad } from './security-log';

/** El carácter nulo y los «sustitutos» sueltos (medio emoji): PostgreSQL no los puede guardar ni buscar. */
// eslint-disable-next-line no-control-regex -- se busca justamente el carácter nulo
const IMPOSIBLE_RE = /[\0\p{Cs}]/u;
/** Ningún pedido legítimo anida tanto; miles de niveles agotaban la pila al validar. */
const MAX_NIVELES = 8;

/** Problema del cuerpo de un pedido (null si está bien). Recorre sin recursión: el cuerpo puede venir muy anidado. */
export function problemaCuerpo(cuerpo: unknown): string | null {
  const pendientes: [unknown, number][] = [[cuerpo, 0]];
  for (let p = pendientes.pop(); p; p = pendientes.pop()) {
    const [valor, nivel] = p;
    if (typeof valor === 'string') {
      if (IMPOSIBLE_RE.test(valor)) return 'El texto tiene caracteres que no se admiten';
    } else if (typeof valor === 'object' && valor !== null) {
      if (nivel >= MAX_NIVELES) return 'La solicitud tiene un formato inválido';
      for (const [k, v] of Object.entries(valor)) {
        if (IMPOSIBLE_RE.test(k)) return 'El texto tiene caracteres que no se admiten';
        pendientes.push([v, nivel + 1]);
      }
    }
  }
  return null;
}

/** Problema de la dirección (ruta y búsquedas): mal codificada o con caracteres imposibles. */
export function problemaUrl(url: string): string | null {
  try {
    return IMPOSIBLE_RE.test(decodeURIComponent(url.replace(/\+/g, ' '))) ? 'La dirección tiene caracteres que no se admiten' : null;
  } catch {
    return 'La dirección está mal escrita';
  }
}

/**
 * Para toda la API, después de leer el cuerpo y antes de cualquier ruta: sin esto, un carácter
 * nulo en un id, una búsqueda o un texto llegaba hasta la base y respondía un error 500.
 */
export function textoSeguro(req: Request, res: Response, next: NextFunction): void {
  const problema = problemaUrl(req.originalUrl) ?? problemaCuerpo(req.body);
  if (problema === null) return next();
  eventoSeguridad('texto.rechazado', { ip: req.ip, metodo: req.method, ruta: req.path });
  res.status(400).json({ statusCode: 400, message: problema });
}
