interface SpinnerProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function Spinner({ size = 'sm', className = '' }: SpinnerProps) {
  const px = size === 'md' ? 'w-5 h-5 border-[3px]' : 'w-3 h-3 border-2';
  return (
    <span
      className={`inline-block rounded-full animate-spin border-teal/20 border-t-teal ${px} ${className}`}
      aria-label="loading"
    />
  );
}
