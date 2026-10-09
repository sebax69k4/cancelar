import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Field, controlBase, describedBy } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, options, placeholder, hint, error, hideLabel, required, className, wrapperClassName, ...rest },
  ref,
) {
  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlBase, 'h-10 appearance-none pr-9 pl-3 text-sm', className)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle"
        aria-hidden="true"
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
