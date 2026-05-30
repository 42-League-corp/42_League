import { useT } from '../lib/i18n';

interface WinRateBarProps {
  wins: number;
  losses: number;
}

/**
 * Barre de win rate façon OP.GG — partagée desktop / mobile.
 * - Segment doré (victoires) + segment rouge (défaites), proportionnels.
 * - Affiche le nombre de victoires / défaites avec la lettre localisée
 *   (FR/ES : V/D, EN : W/L) — repli sur la lettre seule puis rien si trop étroit.
 * - Le `%` se place À GAUCHE en jaune si win rate > 50, sinon À DROITE en rouge.
 *   Deux emplacements de largeur fixe → la barre reste alignée d'une ligne à l'autre.
 */
export function WinRateBar({ wins, losses }: WinRateBarProps) {
  const t = useT();
  const games = wins + losses;
  if (games === 0) return <span className="text-muted/40 text-xs">—</span>;

  const winRate = Math.round((wins / games) * 100);
  const lossPct = 100 - winRate;
  const high = winRate > 50;
  const W = t('lb.abbr.win');
  const L = t('lb.abbr.loss');

  return (
    <span className="flex w-full items-center gap-1.5">
      <span
        className="w-9 shrink-0 text-right text-xs font-extrabold tabular-nums"
        style={{ color: '#ffc94a' }}
      >
        {high ? `${winRate}%` : ''}
      </span>
      <span className="flex h-4 flex-1 min-w-[60px] overflow-hidden rounded-md text-[9px] font-extrabold leading-none ring-1 ring-black/30">
        <span
          className="flex h-full shrink-0 items-center justify-start overflow-hidden whitespace-nowrap pl-1.5 text-[#1a1100]"
          style={{ width: `${winRate}%`, background: 'rgba(255,201,74,0.92)' }}
        >
          {winRate >= 24 ? `${wins}${W}` : winRate >= 11 ? W : ''}
        </span>
        <span
          className="flex h-full flex-1 items-center justify-end overflow-hidden whitespace-nowrap pr-1.5 text-white"
          style={{ background: 'rgba(255,83,102,0.85)' }}
        >
          {lossPct >= 24 ? `${losses}${L}` : lossPct >= 11 ? L : ''}
        </span>
      </span>
      <span
        className="w-9 shrink-0 text-left text-xs font-extrabold tabular-nums"
        style={{ color: '#ff5366' }}
      >
        {high ? '' : `${winRate}%`}
      </span>
    </span>
  );
}
