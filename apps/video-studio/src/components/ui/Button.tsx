import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';

const buttonVariants = cva('inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm', {
  variants: {
    variant: {
      primary: 'bg-[var(--app-primary)] text-white hover:opacity-90',
      ghost: 'bg-transparent text-[var(--app-text-secondary)] hover:bg-[var(--app-hover)]',
      danger: 'bg-red-500 text-white hover:bg-red-600',
      outline: 'border border-[var(--app-border)] bg-transparent text-[var(--app-text)] hover:bg-[var(--app-hover)]',
    },
    size: {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4',
      lg: 'h-10 px-6',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={clsx(buttonVariants({ variant, size }), className)} {...props} />;
}
