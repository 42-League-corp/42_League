import { Pencil, Plus } from 'lucide-react';
import { iconForGame, type FightingGame } from '../lib/chars';
import { gameColor, GAME_LOGO_SRC, GAME_EMOJI } from '../lib/gameVisuals';

interface FavoriteCharsRowProps {
  game: FightingGame;
  ids: string[];
  /** Diamètre des deux gros ronds (px). */
  size?: number;
  /** Affiche le logo du mode au-dessus des ronds. */
  showLogo?: boolean;
  /** Si fourni (= SON profil), le bloc entier est cliquable → ouvre l'éditeur. */
  onEdit?: () => void;
  className?: string;
}

/**
 * Persos favoris (« mains ») d'un joueur pour un jeu de combat : DEUX gros ronds
 * centrés. Cliquer dessus ouvre l'éditeur (uniquement sur SON profil, via
 * `onEdit`) ; sur la fiche d'un autre joueur c'est en lecture seule. Emplacement
 * vide → rond pointillé (« + » si éditable, « – » sinon).
 */
export function FavoriteCharsRow({
  game,
  ids,
  size = 56,
  showLogo = true,
  onEdit,
  className = '',
}: FavoriteCharsRowProps) {
  const Icon = iconForGame(game);
  const c = gameColor(game);
  const editable = !!onEdit;
  // Toujours deux emplacements affichés (placeholder si non renseigné).
  const slots: (string | null)[] = [ids[0] ?? null, ids[1] ?? null];

  const inner = (
    <div className="flex flex-col items-center gap-2">
      {showLogo && (
        <span className="flex items-center gap-1.5">
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full"
            style={{ background: `${c}1f`, border: `1px solid ${c}59` }}
          >
            {GAME_LOGO_SRC[game] ? (
              <img src={GAME_LOGO_SRC[game]} alt="" aria-hidden className="w-3.5 h-3.5 object-contain" />
            ) : (
              <span className="text-[11px] leading-none">{GAME_EMOJI[game]}</span>
            )}
          </span>
          {editable && (
            <Pencil
              className="w-3 h-3 text-muted-2 transition-colors group-hover/fav:text-text"
              strokeWidth={2.5}
            />
          )}
        </span>
      )}

      <div className="flex items-center justify-center gap-3">
        {slots.map((id, i) => (
          <span
            key={i}
            className="relative inline-flex items-center justify-center overflow-hidden rounded-full transition-transform group-hover/fav:scale-105"
            style={{
              width: size,
              height: size,
              boxShadow: id
                ? `0 0 0 2px ${c}, 0 0 16px -5px ${c}, inset 0 2px 4px rgba(255,255,255,0.16)`
                : `inset 0 0 0 2px ${c}40`,
              background: id ? undefined : `${c}0d`,
            }}
          >
            {id ? (
              <Icon id={id} size={size} className="!rounded-none" />
            ) : editable ? (
              <Plus className="h-6 w-6" style={{ color: `${c}99` }} strokeWidth={2.5} />
            ) : (
              <span className="text-base font-bold" style={{ color: `${c}66` }}>–</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );

  if (editable) {
    return (
      <button
        type="button"
        onClick={onEdit}
        aria-label="Éditer les persos favoris"
        className={`group/fav mx-auto block tap-transparent ${className}`}
      >
        {inner}
      </button>
    );
  }
  return <div className={`mx-auto ${className}`}>{inner}</div>;
}
