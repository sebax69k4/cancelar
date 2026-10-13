import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-panel rounded-lg border border-border bg-surface shadow-card', className)} {...rest} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}

export function CardHeader({ title, description, icon, actions, className, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('ui-panel-header flex items-start gap-3 border-b border-border px-4 py-3', className)}>
      {icon && <span className="mt-0.5 text-muted [&_svg]:size-5">{icon}</span>}
      <div className="min-w-0 flex-1">
        <Heading className="text-base font-semibold">{title}</Heading>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...rest} />;
}
