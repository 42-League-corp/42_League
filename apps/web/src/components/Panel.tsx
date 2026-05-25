import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, sub, children, className = '' }: PanelProps) {
  return (
    <section className={`bg-bg-1/60 border border-border rounded p-4 sm:p-6 ${className}`}>
      <h2 className="text-base font-extrabold uppercase tracking-[0.18em] text-text-strong mb-4 flex items-baseline gap-2">
        <span>{title}</span>
        {sub && (
          <span className="text-[10px] font-semibold text-muted normal-case tracking-[0.12em]">
            {sub}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
