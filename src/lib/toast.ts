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
