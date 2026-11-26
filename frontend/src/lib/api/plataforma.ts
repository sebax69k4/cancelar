/**
 * Cliente de la administración de la plataforma (/api/plataforma). Aparte del apiClient de los
 * talleres: usa otra cookie de sesión y nunca se mezcla con la de un taller.
 */
import type { Rol } from '@/types/domain';
import { API_URL } from './config';
import { ApiError, type ApiErrorCode } from './errors';

export type RolPlataforma = 'MODERADOR' | 'ADMINISTRADOR';

export interface CuentaPlataforma {
  id: string;
  nombre: string;
  email: string;
  rol: RolPlataforma;
  expira?: string;
}

export type ResultadoIngreso =
  | { estado: 'codigo' }
  | { estado: 'configurar'; secreto: string; uri: string }
  | { estado: 'listo'; cuenta: CuentaPlataforma };

export interface TallerResumen {
  id: number;
  nombre: string;
  creadoEn: string;
  configurado: boolean;
  suspendido: boolean;
  motivoSuspension: string | null;
  suspendidoEn: string | null;
  personas: number;
  ordenes: number;
  ultimaActividad: string;
}

export interface PersonaDeTaller {
  id: string;
  nombre: string;
  roles: Rol[];
  activo: boolean;
  /** Solo lo recibe el Administrador de plataforma. */
  email?: string;
}

export interface CuentaListada extends CuentaPlataforma {
  activo: boolean;
  segundoFactor: boolean;
  creadoEn: string;
}

export interface Accion {
  id: string;
  fecha: string;
  cuenta: { nombre: string; rol: RolPlataforma } | null;
  accion: string;
  tallerId: number | null;
  usuarioId: string | null;
  detalle: string | null;
  ip: string | null;
}

const CODIGO: Record<number, ApiErrorCode> = { 400: 'VALIDATION', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'WORKFLOW_RULE' };

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/plataforma${ruta}`, {
      method: metodo,
      credentials: 'include',
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError('NETWORK', 'No se pudo conectar con el servidor');
  }
  if (res.status === 204) return undefined as T;
  const datos: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const m = (datos as { message?: unknown } | null)?.message;
    const lista = Array.isArray(m) ? m.filter((x): x is string => typeof x === 'string') : [];
    const texto = typeof m === 'string' ? m : lista.length === 1 ? lista[0]! : lista.length ? 'Hay datos inválidos' : `Error ${res.status}`;
    throw new ApiError(CODIGO[res.status] ?? 'NETWORK', texto, lista.length > 1 ? lista : []);
  }
  return datos as T;
}

export const plataforma = {
  me: () => pedir<CuentaPlataforma>('GET', '/me'),
  ingresar: (email: string, password: string, codigo?: string) =>
    pedir<ResultadoIngreso>('POST', '/login', { email, password, ...(codigo ? { codigo } : {}) }),
  activarSegundoFactor: (codigo: string) => pedir<{ estado: 'listo'; cuenta: CuentaPlataforma }>('POST', '/segundo-factor', { codigo }),
  salir: () => pedir<void>('POST', '/logout'),

  talleres: () => pedir<TallerResumen[]>('GET', '/talleres'),
  personas: (tallerId: number) => pedir<PersonaDeTaller[]>('GET', `/talleres/${tallerId}/personas`),
  suspenderTaller: (tallerId: number, motivo: string) => pedir<void>('POST', `/talleres/${tallerId}/suspender`, { motivo }),
  reactivarTaller: (tallerId: number) => pedir<void>('POST', `/talleres/${tallerId}/reactivar`),
  activoPersona: (id: string, activo: boolean) => pedir<void>('PATCH', `/personas/${encodeURIComponent(id)}`, { activo }),
  claveNueva: (id: string, password: string) => pedir<void>('POST', `/personas/${encodeURIComponent(id)}/clave`, { password }),

  cuentas: () => pedir<CuentaListada[]>('GET', '/cuentas'),
  crearModerador: (datos: { nombre: string; email: string; password: string }) => pedir<CuentaPlataforma>('POST', '/cuentas', datos),
  activoCuenta: (id: string, activo: boolean) => pedir<void>('PATCH', `/cuentas/${encodeURIComponent(id)}`, { activo }),
  bitacora: () => pedir<Accion[]>('GET', '/bitacora'),
};
