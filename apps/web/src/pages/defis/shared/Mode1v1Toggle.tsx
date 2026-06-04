import { useEffect } from 'react';
import type { Game } from '../../../lib/api';

export type DuelMode = '1v1' | '2v2';

/**
 * Bascule 1v1 / 2v2 pour la déclaration et le défi. Le 2v2 n'existe QUE pour le
 * Babyfoot → pour les autres jeux le toggle ne s'affiche pas et force `1v1`.
 */
export function Mode1v1Toggle({
  mode,
  onChange,
  game,
  className = '',
}: {
  mode: DuelMode;
  onChange: (m: DuelMode) => void;
  game: Game;
  className?: string;
}) {
  // Sécurité : si on quitte le babyfoot alors qu'on est en 2v2, on rebascule en 1v1.
  useEffect(() => {
    if (game !== 'babyfoot' && mode !== '1v1') onChange('1v1');
  }, [game, mode, onChange]);

  if (game !== 'babyfoot') return null;

  return (
    <div className={`flex gap-1 p-1 rounded-xl bg-bg-1/60 border border-border ${className}`}>
      {(['1v1', '2v2'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex-1 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all ${
            mode === m ? 'bg-gold/15 text-gold border border-gold/40' : 'text-muted-2 hover:text-gold/80'
          }`}
        >
          {m === '1v1' ? '1 vs 1' : '2 vs 2'}
        </button>
      ))}
    </div>
  );
}
