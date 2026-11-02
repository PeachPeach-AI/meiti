import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  onIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, onIconClick, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          className={clsx(
            'w-full h-9 px-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] text-sm placeholder:text-gray-400 focus:outline-none focus:border-[var(--app-primary)] transition-colors',
            icon && 'pr-9',
            className
          )}
          {...props}
        />
        {icon && (
          <button type="button" onClick={onIconClick} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--app-text)]">
            {icon}
          </button>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export function Select({ className, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select className={clsx('w-full h-9 px-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] text-sm focus:outline-none focus:border-[var(--app-primary)] transition-colors', className)} {...props}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--app-text-secondary)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}
