import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type MetricTone = 'neutral' | 'red' | 'rose' | 'orange' | 'green';

const toneIcon: Record<MetricTone, string> = {
  neutral: 'bg-primary-soft text-primary',
  red: 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  orange: 'bg-orange-50 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  green: 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300',
};

export interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: MetricTone;
  href: string;
  hint?: string;
  /** Resalta la tarjeta (ej. hay críticas vencidas). */
  alert?: boolean;
}

export function MetricCard({ label, value, icon: Icon, tone = 'neutral', href, hint, alert }: MetricCardProps) {
  return (
    <a
      href={href}
      className={cn(
        'group flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card transition-colors hover:border-border-strong',
        alert ? 'border-red-300 dark:border-red-500/50' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-md', toneIcon[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      {hint && <span className={cn('text-xs', alert ? 'font-semibold text-danger' : 'text-muted')}>{hint}</span>}
    </a>
  );
}
