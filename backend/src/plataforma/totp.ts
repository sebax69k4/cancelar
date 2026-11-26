/**
 * Segundo factor con códigos de 6 dígitos que cambian cada 30 s (TOTP, RFC 6238): lo que generan
 * Google Authenticator, Microsoft Authenticator, Authy y similares. Sin dependencias externas.
 */
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PASO_MS = 30_000;

export function aBase32(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

export function deBase32(texto: string): Buffer {
  const limpio = texto.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const c of limpio) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) throw new Error('Secreto TOTP inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits al azar, como recomienda el RFC 4226. */
export function nuevoSecretoTotp(): string {
  return aBase32(randomBytes(20));
}

export function pasoActual(ahoraMs = Date.now()): number {
  return Math.floor(ahoraMs / PASO_MS);
}

/** Código de `digitos` cifras para un paso de tiempo. */
export function codigoTotp(secretoBase32: string, paso: number, digitos = 6): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const hmac = createHmac('sha1', deBase32(secretoBase32)).update(contador).digest();
  const desde = hmac[hmac.length - 1]! & 0x0f;
  const numero = (hmac.readUInt32BE(desde) & 0x7fffffff) % 10 ** digitos;
  return String(numero).padStart(digitos, '0');
}

/**
 * Paso del código si es válido (se acepta el de 30 s antes o después, por relojes corridos).
 * Un paso ya usado no vuelve a servir: así un código visto por encima del hombro no sirve dos veces.
 */
export function verificarTotp(secretoBase32: string, codigo: string, ultimoPaso: number | null, ahoraMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const actual = pasoActual(ahoraMs);
  for (const paso of [actual, actual - 1, actual + 1]) {
    if (ultimoPaso !== null && paso <= ultimoPaso) continue;
    if (timingSafeEqual(Buffer.from(codigoTotp(secretoBase32, paso)), Buffer.from(codigo))) return paso;
  }
  return null;
}

/** Dirección que abren las apps autenticadoras (también se puede cargar el secreto a mano). */
export function uriTotp(secretoBase32: string, email: string): string {
  const emisor = 'ServicioTécnico';
  return `otpauth://totp/${encodeURIComponent(`${emisor}:${email}`)}?secret=${secretoBase32}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`;
}

// ------------------------------------------------------------------ cifrado del secreto en la base

function clave(jwtSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', jwtSecret, 'servicio-tecnico', 'secreto-totp-plataforma', 32));
}

/** El secreto se guarda cifrado: quien lea la base no puede generar códigos sin JWT_SECRET. */
export function cifrarSecreto(secreto: string, jwtSecret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(jwtSecret), iv);
  const datos = Buffer.concat([c.update(secreto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), datos.toString('base64url')].join('.');
}

export function descifrarSecreto(guardado: string, jwtSecret: string): string {
  const [version, iv, tag, datos] = guardado.split('.');
  if (version !== 'v1' || !iv || !tag || !datos) throw new Error('Secreto TOTP guardado con un formato desconocido');
  const d = createDecipheriv('aes-256-gcm', clave(jwtSecret), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(datos, 'base64url')), d.final()]).toString('utf8');
}
