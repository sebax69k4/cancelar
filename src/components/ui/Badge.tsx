import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
  | 'slate' | 'violet' | 'blue' | 'cyan' | 'green' | 'gray'
  | 'teal' | 'amber' | 'red' | 'rose' | 'orange';

/** Fondo tintado + texto oscuro del mismo tono: contraste ≥ 7:1 en ambos temas. */
const tones: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-800 ring-slate-300 dark:bg-slate-400/15 dark:text-slate-200 dark:ring-slate-400/30',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:ring-violet-400/30',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-400/15 dark:text-blue-200 dark:ring-blue-400/30',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-400/15 dark:text-cyan-200 dark:ring-cyan-400/30',
  green: 'bg-green-50 text-green-800 ring-green-200 dark:bg-green-400/15 dark:text-green-200 dark:ring-green-400/30',
  gray: 'bg-gray-100 text-gray-700 ring-gray-300 dark:bg-gray-400/15 dark:text-gray-300 dark:ring-gray-400/30',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-400/15 dark:text-teal-200 dark:ring-teal-400/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/30',
  red: 'bg-red-50 text-red-800 ring-red-200 dark:bg-red-400/15 dark:text-red-200 dark:ring-red-400/30',
  rose: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/30',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-400/15 dark:text-orange-200 dark:ring-orange-400/30',
};

/** Variante enfática (sólida) para Crítica: llama la atención sin teñir toda la tarjeta. */
const solid: Partial<Record<BadgeTone, string>> = {
  red: 'bg-red-700 text-white ring-red-700 dark:bg-red-500 dark:text-red-950 dark:ring-red-500',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
  emphasis?: boolean;
  size?: 'sm' | 'md';
}

export function Badge({ tone = 'slate', icon, emphasis, size = 'md', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm font-semibold whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'h-5 px-1.5 text-[11px] [&_svg]:size-3' : 'h-6 px-2 text-xs [&_svg]:size-3.5',
        (emphasis && solid[tone]) || tones[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
