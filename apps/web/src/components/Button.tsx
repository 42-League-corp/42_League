import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  // Primary = bouton "+ GAME" orange/ambre du screenshot.
  primary:
    'shine bg-gradient-to-b from-[#ffa83a] via-[#f08020] to-[#c5520a] text-[#1a0d00] ' +
    'border border-[#ffc966]/60 ' +
    'shadow-[inset_0_1px_0_rgba(255,247,228,0.5),inset_0_-1px_0_rgba(0,0,0,0.35),0_4px_14px_rgba(255,128,32,0.4)] ' +
    'hover:from-[#ffb84a] hover:via-[#ff8830] hover:to-[#d65a10] hover:shadow-[inset_0_1px_0_rgba(255,247,228,0.6),0_8px_22px_rgba(255,128,32,0.55)] ' +
    'hover:brightness-[1.05]',
  // Gold = bouton or pur (premium).
  gold:
    'shine metal-plate-gold font-black ' +
    'hover:brightness-110 hover:shadow-gold-glow',
  // Ghost = bouton outline doré.
  ghost:
    'bg-transparent text-muted-2 border border-border ' +
    'hover:text-gold hover:border-gold/60 hover:bg-gold/5 hover:shadow-[inset_0_0_0_1px_rgba(255,201,74,0.15)]',
  // Danger = bouton rouge sang séché.
  danger:
    'shine bg-gradient-to-b from-red to-red-deep text-white ' +
    'border border-red/60 ' +
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(255,83,102,0.35)] ' +
    'hover:brightness-110 hover:shadow-red-glow',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-4 py-2.5 text-xs',
  lg: 'px-5 py-3 text-sm',
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
        `relative overflow-hidden inline-flex items-center justify-center gap-1.5 font-extrabold uppercase tracking-wider rounded-lg ` +
        `transition-all duration-200 active:scale-[0.97] tap-transparent ` +
        `disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:hover:shadow-none ` +
        `${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`
      }
      {...rest}
    >
      {loading && (
        <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
});
