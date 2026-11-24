import { randomUUID } from 'node:crypto';

/**
 * Corte de sesiones: un JWT emitido antes de `sesionesDesde` deja de valer.
 * El `iat` estándar del JWT va en segundos; cada token lleva además `t`, el instante de emisión
 * en milisegundos, para que una sesión abierta en el mismo segundo que el corte también caiga.
 * `jti` identifica cada sesión: al cerrar sesión se anota y ese token deja de valer aunque
 * alguien lo haya copiado.
 */
export interface SessionPayload {
  sub: string;
  /** emisión en ms */
  t?: number;
  /** id único de la sesión */
  jti?: string;
  iat?: number;
  /** vencimiento (segundos), lo agrega la firma */
  exp?: number;
}

/** Único algoritmo aceptado: sin esto, un token con otro algoritmo (o «none») podría colarse. */
export const JWT_ALGORITMO = 'HS256' as const;

export function nuevaSesion(userId: string): SessionPayload {
  return { sub: userId, t: Date.now(), jti: randomUUID() };
}

export function corteDeSesiones(): Date {
  return new Date();
}

export function sesionVigente(payload: SessionPayload, sesionesDesde: Date | null): boolean {
  if (!sesionesDesde) return true;
  // Tokens anteriores a este cambio no tienen `t`: se usa `iat` (segundos)
  const emitido = typeof payload.t === 'number' ? payload.t : (payload.iat ?? 0) * 1000;
  return emitido >= sesionesDesde.getTime();
}
