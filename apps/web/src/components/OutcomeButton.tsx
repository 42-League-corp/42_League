import type { ReactNode } from 'react';

interface OutcomeButtonProps {
  kind: 'win' | 'loss';
  onClick: () => void;
  children: ReactNode;
}

export function OutcomeButton({ kind, onClick, children }: OutcomeButtonProps) {
  const isWin = kind === 'win';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden py-6 rounded-xl border-2 transition-all duration-300 active:scale-[0.97] shadow-sm hover:shadow-xl ${
        isWin
          ? 'border-teal/30 bg-teal/5 hover:border-teal hover:bg-teal/10 hover:shadow-teal/20'
          : 'border-red/30 bg-red/5 hover:border-red hover:bg-red/10 hover:shadow-red/20'
      }`}
    >
      <div className="relative flex flex-col items-center gap-2">
        <span
          aria-hidden="true"
          className={`text-3xl transition-transform duration-300 group-hover:scale-125 group-hover:-translate-y-1 ${
            isWin ? '' : 'grayscale opacity-80'
          }`}
        >
          {isWin ? '🏆' : '💀'}
        </span>
        <span
          className={`text-sm font-extrabold uppercase tracking-widest ${
            isWin ? 'text-teal' : 'text-red'
          }`}
        >
          {children}
        </span>
      </div>
    </button>
  );
}
