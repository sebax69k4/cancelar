import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import type { Usuario } from '@/types/domain';

export function UserChip({ user, label, className }: { user: Pick<Usuario, 'nombre'> | null; label?: string; className?: string }) {
  if (!user) return <span className={cn('text-xs text-subtle italic', className)}>Sin asignar</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-muted"
      >
        {initials(user.nombre)}
      </span>
      <span className="truncate text-xs text-muted">
        {label && <span className="sr-only">{label}: </span>}
        {user.nombre}
      </span>
    </span>
  );
}
