import { Pencil } from 'lucide-react';
import { iconForGame, type FightingGame } from '../lib/chars';
import { gameColor, GAME_LOGO_SRC, GAME_EMOJI } from '../lib/gameVisuals';

interface FavoriteCharsRowProps {
  game: FightingGame;
  ids: string[];
  /** Taille des vignettes (px). Compact par défaut. */
  size?: number;
  /** Affiche le logo du mode à gauche de la rangée. */
  showLogo?: boolean;
  /** Si fourni, affiche un crayon d'édition à droite (profil perso). */
  onEdit?: () => void;
  className?: string;
}

/**
 * Rangée compacte des persos favoris d'un joueur pour un jeu de combat. Lecture
 * seule (affichage profil / fiche d'un autre joueur). Vide → « - » (même règle
 * que les séries du classement). Le crayon n'apparaît que sur SON profil.
 */
export function FavoriteCharsRow({
  game,
  ids,
  size = 28,
  showLogo = true,
  onEdit,
  className = '',
}: FavoriteCharsRowProps) {
  const Icon = iconForGame(game);
  const c = gameColor(game);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLogo && (
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
          style={{ background: `${c}1f`, border: `1px solid ${c}59` }}
        >
          {GAME_LOGO_SRC[game] ? (
            <img src={GAME_LOGO_SRC[game]} alt="" aria-hidden className="w-4 h-4 object-contain" />
          ) : (
            <span className="text-sm leading-none">{GAME_EMOJI[game]}</span>
          )}
        </span>
      )}
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {ids.length === 0 ? (
          <span className="text-muted/50 text-xs">-</span>
        ) : (
          ids.map((id) => <Icon key={id} id={id} size={size} className="shrink-0" />)
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Éditer les favoris"
          className="ml-auto shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/5 transition-colors tap-transparent"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
