import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  id: string;
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, description, className, ...rest },
  ref,
) {
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-describedby={description ? `${id}-desc` : undefined}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm border-border-strong accent-[var(--primary)] disabled:cursor-not-allowed"
        {...rest}
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="text-xs text-muted">
            {description}
          </span>
        )}
      </div>
    </div>
  );
});
