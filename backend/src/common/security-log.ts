import { Logger } from '@nestjs/common';

/**
 * Registro de eventos de seguridad (logins, accesos denegados, cambios de cuentas, archivos
 * rechazados). Cada línea es un JSON: los saltos de línea de un valor quedan escapados, así
 * nadie puede inventar líneas falsas en el log (inyección de logs). Nunca incluye contraseñas,
 * tokens ni el email completo.
 */
const logger = new Logger('Seguridad');

type Valor = string | number | boolean | null | undefined;

export function eventoSeguridad(evento: string, datos: Record<string, Valor> = {}, nivel: 'log' | 'warn' = 'warn'): void {
  const limpio = Object.fromEntries(
    Object.entries(datos)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 200) : v]),
  );
  logger[nivel](JSON.stringify({ evento, ...limpio }));
}

/** «ana.perez@taller.com» → «a***@taller.com»: alcanza para investigar sin guardar el email entero. */
export function ocultarEmail(email: unknown): string {
  if (typeof email !== 'string') return '***';
  const [usuario = '', dominio] = email.trim().toLowerCase().split('@');
  return dominio ? `${usuario.slice(0, 1)}***@${dominio}` : '***';
}
