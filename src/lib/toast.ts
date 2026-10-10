/** Cola global de toasts (sin Provider: cualquier isla puede emitir). */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  details?: readonly string[];
  duration: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let items: readonly ToastItem[] = [];
let seq = 0;

function emit(): void {
  for (const l of listeners) l();
}

function push(type: ToastType, title: string, opts: { description?: string; details?: readonly string[]; duration?: number } = {}): number {
  const id = ++seq;
  const duration = opts.duration ?? (type === 'error' || type === 'warning' ? 7000 : 5000);
  items = [...items, { id, type, title, description: opts.description, details: opts.details, duration }].slice(-4);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, opts?: { description?: string; duration?: number }) => push('success', title, opts),
  info: (title: string, opts?: { description?: string; duration?: number }) => push('info', title, opts),
  warning: (title: string, opts?: { description?: string; details?: readonly string[]; duration?: number }) =>
    push('warning', title, opts),
  error: (title: string, opts?: { description?: string; details?: readonly string[]; duration?: number }) =>
    push('error', title, opts),
};

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getToasts(): readonly ToastItem[] {
  return items;
}

// ---- Toast "flash": sobrevive a una redirección (se muestra en la página siguiente)

const FLASH_KEY = 'st.flash';

interface FlashToast {
  type: ToastType;
  title: string;
  description?: string;
}

export function flashToast(type: ToastType, title: string, description?: string): void {
  try {
    window.sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, title, description } satisfies FlashToast));
  } catch {
    /* sin sessionStorage: se pierde el aviso, no es crítico */
  }
}

export function consumeFlashToast(): void {
  try {
    const raw = window.sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(FLASH_KEY);
    const f = JSON.parse(raw) as FlashToast;
    push(f.type, f.title, { description: f.description });
  } catch {
    /* ignorado */
  }
}
