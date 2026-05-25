import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-teal to-teal-dim text-[#001416] hover:brightness-110 hover:shadow-teal-glow',
  ghost:
    'bg-transparent text-muted-2 border border-border hover:text-teal hover:border-teal hover:bg-teal/5',
  danger:
    'bg-gradient-to-b from-red to-[#c8203f] text-white hover:shadow-[0_0_14px_rgba(255,59,92,0.5)]',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-4 py-2.5 text-xs',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', full, loading, disabled, children, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={
        `inline-flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider rounded transition active:scale-[0.97] ` +
        `disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:filter-none disabled:hover:shadow-none ` +
        `${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`
      }
      {...rest}
    >
      {loading && (
        <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
});
