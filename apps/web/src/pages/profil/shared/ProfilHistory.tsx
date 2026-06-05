import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Game, PlayedMatch } from '../../../lib/api';
import { GAMES, GAME_META } from '../../../lib/gameMeta';
import { useT } from '../../../lib/i18n';
import { RecentMatchRow } from './RecentMatchRow';

type Filter = 'all' | Game;

interface ProfilHistoryProps {
  /** Login du joueur dont on affiche l'historique (perspective « moi »). */
  login: string;
  /** Historique global (GET /matches) — filtré ici par joueur + mode. */
  matches: PlayedMatch[];
  /** Nb max de lignes affichées (20 desktop, 10 mobile). */
  limit?: number;
  /** Affiche le lien « voir tout l'historique » sous la liste (mobile). */
  showFullHistoryLink?: boolean;
}

/**
 * Historique de match d'un profil, filtrable par mode de jeu — partagé entre le
 * profil perso (desktop + mobile) et la fiche d'un autre joueur (PlayerPage).
 * Découplé du sélecteur de mode global : « Tous » mélange les disciplines (chaque
 * ligne porte sa pastille de mode), sinon on isole une discipline. On n'affiche
 * que les onglets des modes réellement joués par ce joueur.
 */
export function ProfilHistory({
  login,
  matches,
  limit = 20,
  showFullHistoryLink = false,
}: ProfilHistoryProps) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>('all');

  // Tous les matchs du joueur, du plus récent au plus ancien.
  const mine = useMemo(
    () =>
      matches
        .filter((m) => m.playerALogin === login || m.playerBLogin === login)
        .sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt)),
    [matches, login],
  );

  // Modes réellement présents dans son historique (pour n'afficher que ces onglets).
  const playedGames = useMemo(() => {
    const present = new Set<Game>();
    for (const m of mine) present.add((m.game ?? 'babyfoot') as Game);
    return GAMES.filter((g) => present.has(g));
  }, [mine]);

  const shown = useMemo(() => {
    const list =
      filter === 'all' ? mine : mine.filter((m) => (m.game ?? 'babyfoot') === filter);
    return list.slice(0, limit);
  }, [mine, filter, limit]);

  if (mine.length === 0) {
    return <div className="text-center py-6 text-sm text-muted-2">{t('profil.noMatchYet')}</div>;
  }

  return (
    <div>
      {/* Filtre par mode — uniquement si le joueur a touché à ≥2 disciplines. */}
      {playedGames.length >= 2 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <FilterPill
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('profil.histFilter.all')}
          />
          {playedGames.map((g) => (
            <FilterPill
              key={g}
              active={filter === g}
              onClick={() => setFilter(g)}
              label={GAME_META[g].shortLabel}
              color={GAME_META[g].color}
              icon={GAME_META[g].icon(filter === g)}
            />
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-2">{t('profil.noMatchYet')}</div>
      ) : (
        <div className="space-y-1.5">
          {shown.map((m, i) => (
            <RecentMatchRow key={m.id} match={m} ownerLogin={login} delay={i * 0.03} />
          ))}
          {showFullHistoryLink && (
            <Link
              to="/history"
              className="flex items-center justify-center gap-1 py-2.5 mt-2 text-xs font-bold text-muted-2 hover:text-teal uppercase tracking-wider tap-transparent transition-colors"
            >
              {t('profil.seeFullHistory')}
              <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Pastille de filtre. Active = remplie de la couleur du mode (gris neutre pour
 *  « Tous ») avec texte sombre ; inactive = contour discret. */
function FilterPill({
  active,
  onClick,
  label,
  color = '#d4d4d8',
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tap-transparent transition-colors border ' +
        (active
          ? 'border-transparent'
          : 'bg-bg-1/40 border-border/60 text-muted-2 hover:text-text-strong')
      }
      style={active ? { backgroundColor: color, color: '#0b0e12', borderColor: color } : undefined}
    >
      {icon && <span className="inline-flex w-4 h-4 items-center justify-center">{icon}</span>}
      {label}
    </button>
  );
}
