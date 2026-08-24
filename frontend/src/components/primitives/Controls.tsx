'use client';

import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconCheck, IconChevronDown, IconSearch } from '@/components/icons';

export function TextField({
  label,
  hint,
  error,
  leading,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  className?: string;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {leading}
          </span>
        ) : null}
        <input
          id={fieldId}
          aria-describedby={cn(hint && hintId, error && errorId) || undefined}
          aria-invalid={error ? true : undefined}
          {...props}
          className={cn(
            'h-11 w-full rounded-field border bg-surface-sunk px-3.5 text-[15px] text-ink-950 outline-none',
            'placeholder:text-ink-400 transition-colors duration-[110ms]',
            'focus:border-helm-500 focus:bg-surface',
            leading && 'pl-10',
            error ? 'border-bad' : 'border-line-strong',
          )}
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-ink-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[12px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SearchField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; className?: string }) {
  const id = useId();
  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
        <IconSearch size={17} />
      </span>
      <input
        id={id}
        type="search"
        placeholder={props.placeholder ?? label}
        {...props}
        className="h-11 w-full rounded-field border border-line-strong bg-surface-sunk pl-10 pr-3.5 text-[15px] text-ink-950 outline-none placeholder:text-ink-400 transition-colors duration-[110ms] focus:border-helm-500 focus:bg-surface"
      />
    </div>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className="relative mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-surface checked:border-helm-500 checked:bg-helm-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none relative text-white opacity-0 peer-checked:opacity-100">
          <IconCheck size={13} strokeWidth={2.6} />
        </span>
      </span>
      <label htmlFor={id} className={cn('cursor-pointer select-none', disabled && 'opacity-55')}>
        <span className="block text-[14px] leading-[20px] text-ink-950">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] text-ink-500">{description}</span> : null}
      </label>
    </div>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={cn('mb-1.5 block text-[13px] font-medium text-ink-700', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-field border border-line-strong bg-surface-sunk pl-3.5 pr-9 text-[14px] text-ink-950 outline-none transition-colors duration-[110ms] focus:border-helm-500 focus:bg-surface"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
          <IconChevronDown size={16} />
        </span>
      </div>
    </div>
  );
}

export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-field border border-line bg-surface-sunk p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 rounded-[9px] px-3 text-[13px] font-medium transition-colors duration-[110ms]',
              active ? 'bg-surface text-ink-950 shadow-[0_1px_2px_rgba(11,18,36,.07)]' : 'text-ink-500 hover:text-ink-950',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-[14px] font-medium text-ink-700 transition-colors hover:text-ink-950"
      >
        <span>{summary}</span>
        <span className={cn('shrink-0 text-ink-400 transition-transform duration-[160ms]', open && 'rotate-180')}>
          <IconChevronDown size={17} />
        </span>
      </button>
      {open ? (
        <div id={id} className="pb-3 pt-1">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Tabs({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; count?: number }[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto no-scrollbar', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-11 shrink-0 px-3.5 text-[14px] font-medium transition-colors duration-[110ms]',
              active ? 'text-ink-950' : 'text-ink-500 hover:text-ink-700',
            )}
          >
            <span className="inline-flex items-center gap-2">
              {option.label}
              {option.count !== undefined ? (
                <span className="mono text-[11px] text-ink-400">{option.count}</span>
              ) : null}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity duration-[140ms]',
                active ? 'bg-helm-500 opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Tooltip that is also visible on focus, never hover-only for meaning. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className="anim-fade pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-control bg-night-800 px-2.5 py-1.5 text-[12px] leading-[17px] text-night-ink shadow-lift"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
