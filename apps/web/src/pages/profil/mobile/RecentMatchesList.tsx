import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PlayedMatch } from '../../../lib/api';
import { useT } from '../../../lib/i18n';
import { RecentMatchRow } from '../shared/RecentMatchRow';

interface RecentMatchesListProps {
  matches: PlayedMatch[];
  myLogin: string | undefined;
}

/**
 * Liste des matches récents pour le profil mobile.
 * Chaque ligne est rendue par le composant partagé <RecentMatchRow /> (même
 * agencement que la version desktop).
 */
export function RecentMatchesList({ matches, myLogin }: RecentMatchesListProps) {
  const t = useT();
  if (matches.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-2">
        {t('profil.noMatchYet')}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {matches.map((m, i) => (
        <RecentMatchRow key={m.id} match={m} ownerLogin={myLogin ?? ''} delay={i * 0.03} />
      ))}
      <Link
        to="/history"
        className="flex items-center justify-center gap-1 py-2.5 mt-2 text-xs font-bold text-muted-2 hover:text-teal uppercase tracking-wider tap-transparent transition-colors"
      >
        {t('profil.seeFullHistory')}
        <ChevronRight className="w-3 h-3" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
