import type { ReactNode } from 'react';
import { AlertOctagon, Inbox, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted [&_svg]:size-6">
        {icon ?? <Inbox aria-hidden="true" />}
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Cargando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-12 text-muted', className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-3', className)} />;
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = 'No se pudo cargar la información', message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-danger dark:bg-red-400/15">
        <AlertOctagon className="size-6" aria-hidden="true" />
      </div>
      <div className="max-w-sm">
        <p className="text-base font-semibold">{title}</p>
        {message && <p className="mt-1 text-sm text-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" leftIcon={<RotateCcw aria-hidden="true" />} onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
