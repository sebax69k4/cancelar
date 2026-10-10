/**
 * Reloj de la demo. Permite simular el paso del tiempo (ej. +24 h) para probar
 * alertas de órdenes críticas sin esperar. Con backend real, `now()` = Date.now().
 */
import { STORAGE_KEYS, readStorage, writeStorage } from './storage';

type Listener = () => void;
const listeners = new Set<Listener>();

export function getClockOffsetHours(): number {
  const n = Number(readStorage(STORAGE_KEYS.clock) ?? '0');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setClockOffsetHours(hours: number): void {
  writeStorage(STORAGE_KEYS.clock, String(Math.max(0, hours)));
  for (const l of listeners) l();
}

export function now(): number {
  return Date.now() + getClockOffsetHours() * 3_600_000;
}

export function nowIso(): string {
  return new Date(now()).toISOString();
}

export function subscribeClock(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.clock) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
