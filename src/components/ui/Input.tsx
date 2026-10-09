import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Field, controlBase, describedBy } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  /** Oculta el label visualmente (se mantiene para lectores de pantalla). */
  hideLabel?: boolean;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, leftIcon, hideLabel, required, className, wrapperClassName, ...rest },
  ref,
) {
  const control = (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle [&_svg]:size-4">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlBase, 'h-10 px-3 text-sm', leftIcon && 'pl-9', className)}
        {...rest}
      />
    </div>
  );

  if (hideLabel) {
    return (
      <div className={wrapperClassName}>
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {control}
      </div>
    );
  }

  return (
    <Field id={id} label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      {control}
    </Field>
  );
});
