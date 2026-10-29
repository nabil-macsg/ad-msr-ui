import { type ComponentProps, useId } from 'react';
import { cn } from '../lib/cn';
import { CONTROL, LABEL } from './control-styles';

/**
 * A label, with the required-field marker drawn in CSS: it isn't part of the label's text, and
 * screen readers learn "required" from the control itself.
 */
const labelClass = (required: boolean | undefined) =>
  cn(LABEL, required && "after:ml-0.5 after:text-danger-fg after:content-['*']");

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('min-h-touch w-full px-3 py-2', CONTROL, className)} {...props} />;
}

interface FieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  readonly label: string;
  readonly error?: string | undefined;
}

/** A labelled input with its validation message, wired for screen readers. */
export function Field({ label, error, className, ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={labelClass(props.required)}>
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  readonly label: string;
  readonly error?: string | undefined;
}

/** A labelled select with its validation message (the label names only the control). */
export function SelectField({ label, error, className, children, ...props }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={labelClass(props.required)}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('block min-h-touch w-full px-3 py-2', CONTROL)}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  readonly label: string;
  readonly error?: string | undefined;
}

/** A labelled multi-line input with its validation message. */
export function TextAreaField({ label, error, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={labelClass(props.required)}>
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('block w-full px-3 py-2', CONTROL)}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
