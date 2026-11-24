import { MAX_EVIDENCIA_MB } from '../domain/validation';

/** Variables de entorno validadas al arrancar (si falta algo, el backend no levanta). */
export interface Env {
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  /** segundos */
  JWT_EXPIRES_IN: number;
  COOKIE_SECURE: boolean;
  UPLOAD_DIR: string;
  UPLOAD_MAX_MB: number;
  /**
   * Cantidad de proxies (Nginx, Caddy, balanceador) delante de la API. Con 1, la IP del cliente
   * se toma de X-Forwarded-For; sin eso, todos los pedidos parecen venir del proxy y los límites
   * de login por IP se aplicarían a todos juntos. 0 = sin proxy (nadie puede falsear la IP).
   */
  TRUST_PROXY: number;
}

/** "8h", "30m", "45s", "2d" o segundos. */
export function parseDuration(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`Duración inválida: ${value}`);
  const n = Number(m[1]);
  const mult = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2] ?? ''] ?? 1;
  return n * mult;
}

/** Tamaño máximo de evidencia: se puede bajar con UPLOAD_MAX_MB, pero nunca pasar de MAX_EVIDENCIA_MB. */
function uploadMaxMb(value: string): number {
  const mb = Number(value);
  if (!Number.isFinite(mb) || mb <= 0 || mb > MAX_EVIDENCIA_MB) {
    throw new Error(`UPLOAD_MAX_MB debe ser un número entre 0 y ${MAX_EVIDENCIA_MB} (MB)`);
  }
  return mb;
}

function trustProxy(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 5) throw new Error('TRUST_PROXY debe ser un número entero entre 0 y 5 (proxies delante de la API)');
  return n;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const str = (k: string, def?: string): string => {
    const v = raw[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (def !== undefined) return def;
    throw new Error(`Falta la variable de entorno ${k} (ver .env.example)`);
  };
  const secret = str('JWT_SECRET');
  if (secret.length < 32 || secret.startsWith('cambiar-por')) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres aleatorios (ver .env.example)');
  }
  const env: Env = {
    PORT: Number(str('PORT', '3000')),
    DATABASE_URL: str('DATABASE_URL'),
    CORS_ORIGIN: str('CORS_ORIGIN', 'http://localhost:4321'),
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: parseDuration(str('JWT_EXPIRES_IN', '8h')),
    COOKIE_SECURE: str('COOKIE_SECURE', 'false') === 'true',
    UPLOAD_DIR: str('UPLOAD_DIR', 'uploads'),
    UPLOAD_MAX_MB: uploadMaxMb(str('UPLOAD_MAX_MB', String(MAX_EVIDENCIA_MB))),
    TRUST_PROXY: trustProxy(str('TRUST_PROXY', '0')),
  };
  if (raw.NODE_ENV === 'production') validarProduccion(env);
  return env;
}

/** Una sesión dura como mucho esto: más tiempo es más tiempo para usar un token robado. */
export const MAX_SESION_SEGUNDOS = 7 * 86400;

/**
 * En producción no se arranca con una configuración insegura: la cookie de sesión viajaría sin
 * cifrar por HTTP, o se aceptarían orígenes sin HTTPS.
 */
function validarProduccion(env: Env): void {
  if (!env.COOKIE_SECURE) throw new Error('En producción COOKIE_SECURE tiene que ser true (la sesión solo viaja por HTTPS)');
  const origenes = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const inseguro = origenes.find((o) => !o.startsWith('https://'));
  if (inseguro) throw new Error(`En producción CORS_ORIGIN solo admite orígenes https:// (${inseguro} no lo es)`);
  if (env.JWT_EXPIRES_IN > MAX_SESION_SEGUNDOS) throw new Error('En producción JWT_EXPIRES_IN no puede pasar de 7 días');
}
