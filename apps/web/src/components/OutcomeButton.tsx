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
      className={`shine group relative overflow-hidden py-6 rounded-2xl border-2 transition-all duration-300 active:scale-[0.97] hover:-translate-y-0.5 ${
        isWin
          ? 'border-gold/40 bg-gradient-to-br from-gold/8 to-gold/[0.02] hover:border-gold hover:bg-gold/15 hover:shadow-gold-glow-lg'
          : 'border-red/40 bg-gradient-to-br from-red/8 to-red/[0.02] hover:border-red hover:bg-red/15 hover:shadow-[0_0_30px_rgba(255,83,102,0.4)]'
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
          className={`font-gaming text-sm font-extrabold uppercase tracking-widest ${
            isWin ? 'text-gold' : 'text-red'
          }`}
          style={{
            textShadow: isWin
              ? '0 0 16px rgba(255, 201, 74, 0.5)'
              : '0 0 12px rgba(255, 83, 102, 0.5)',
          }}
        >
          {children}
        </span>
      </div>
    </button>
  );
}
