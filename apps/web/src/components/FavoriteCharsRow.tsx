import type { FightingGame } from '../lib/chars';
import { gameColor, GAME_LOGO_SRC, GAME_EMOJI } from '../lib/gameVisuals';

interface FavoriteCharsRowProps {
  game: FightingGame;
  /** Conservé pour compat d'appel — on n'affiche plus les persos, juste le logo. */
  ids?: string[];
  /** Diamètre du gros rond (px). */
  size?: number;
  /** Conservé pour compat d'appel (le logo est désormais le rond lui-même). */
  showLogo?: boolean;
  /** Si fourni (= SON profil) : clic → ouvre le sélecteur de persos. */
  onEdit?: () => void;
  className?: string;
}

/**
 * Entrée « persos favoris » d'un jeu de combat : un gros rond portant le LOGO du
 * jeu (Smash / SF). Sur SON profil (`onEdit`), cliquer ouvre le sélecteur de
 * persos ; sinon le rond est en lecture seule (indique la discipline).
 */
export function FavoriteCharsRow({
  game,
  size = 56,
  onEdit,
  className = '',
}: FavoriteCharsRowProps) {
  const c = gameColor(game);
  const editable = !!onEdit;

  const circle = (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden rounded-full transition-transform group-hover/fav:scale-105"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 2px ${c}, 0 0 16px -5px ${c}, inset 0 2px 4px rgba(255,255,255,0.16)`,
        background: `${c}14`,
      }}
    >
      {GAME_LOGO_SRC[game] ? (
        <img
          src={GAME_LOGO_SRC[game]}
          alt={game}
          draggable={false}
          className="object-contain"
          style={{ width: size * 0.58, height: size * 0.58 }}
        />
      ) : (
        <span style={{ fontSize: size * 0.5 }}>{GAME_EMOJI[game]}</span>
      )}
    </span>
  );

  if (editable) {
    return (
      <button
        type="button"
        onClick={onEdit}
        aria-label="Éditer les persos favoris"
        className={`group/fav inline-block tap-transparent ${className}`}
      >
        {circle}
      </button>
    );
  }
  return <span className={`inline-block ${className}`}>{circle}</span>;
}
