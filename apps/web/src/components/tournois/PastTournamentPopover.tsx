import { Avatar } from '../Avatar';
import type { Tournament, TournamentMatch } from '../../lib/api';

/**
 * Synthèse d'un tournoi TERMINÉ déduite de ses matchs de bracket :
 *   - vainqueur + nombre de victoires dans le tournoi ;
 *   - finale (les deux finalistes + score) ;
 *   - demi-finales (l'« arbre de qualif » des demi-finalistes vers la finale).
 * Renvoie null si le tournoi n'a pas de phase à élimination exploitable.
 */
function summarize(t: Tournament): {
  winner: string | null;
  winnerWins: number;
  final: TournamentMatch | null;
  semis: TournamentMatch[];
  semifinalists: string[];
} | null {
  const bracket = (t.matches ?? []).filter((m) => (m.stage ?? 'bracket') === 'bracket');
  if (bracket.length === 0) return null;
  const maxRound = Math.max(...bracket.map((m) => m.round));
  const final = bracket.find((m) => m.round === maxRound) ?? null;
  const semis = bracket
    .filter((m) => m.round === maxRound - 1)
    .sort((a, b) => a.slot - b.slot);
  const winner = t.winnerLogin ?? final?.winnerLogin ?? null;
  // Demi-finalistes = les PERDANTS des demi-finales (les 3ᵉ/4ᵉ du dernier carré).
  const semifinalists = semis
    .map((m) => (m.winnerLogin === m.playerALogin ? m.playerBLogin : m.playerALogin))
    .filter((l): l is string => !!l);
  const winnerWins = winner ? bracket.filter((m) => m.winnerLogin === winner).length : 0;
  return { winner, winnerWins, final, semis, semifinalists };
}

/** Ligne de match compacte « A  score  B », le vainqueur surligné. */
function MatchLine({ m }: { m: TournamentMatch }) {
  const aWon = m.winnerLogin && m.winnerLogin === m.playerALogin;
  const bWon = m.winnerLogin && m.winnerLogin === m.playerBLogin;
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className={`flex items-center gap-1 min-w-0 flex-1 justify-end ${aWon ? 'text-gold font-bold' : 'text-muted-2'}`}>
        <span className="truncate">{m.playerALogin ?? '—'}</span>
        <Avatar login={m.playerALogin ?? ''} imageUrl={null} size="xs" />
      </span>
      <span className="font-mono tabular-nums text-text-strong shrink-0">
        {m.scoreA ?? '-'}–{m.scoreB ?? '-'}
      </span>
      <span className={`flex items-center gap-1 min-w-0 flex-1 ${bWon ? 'text-gold font-bold' : 'text-muted-2'}`}>
        <Avatar login={m.playerBLogin ?? ''} imageUrl={null} size="xs" />
        <span className="truncate">{m.playerBLogin ?? '—'}</span>
      </span>
    </div>
  );
}

/**
 * Carte de survol d'un tournoi terminé (desktop). S'affiche au group-hover de la
 * carte, au-dessus, sans intercepter le clic (pointer-events-none → le clic part
 * sur le Link de la carte = page détail). Rendue uniquement si le bracket est
 * exploitable (sinon on ne montre rien de plus que le 🏆 déjà sur la carte).
 */
export function PastTournamentPopover({ t }: { t: Tournament }) {
  const s = summarize(t);
  if (!s || !s.winner) return null;
  return (
    <div className="pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-72 rounded-xl border border-gold/30 bg-bg-0/98 backdrop-blur-sm shadow-2xl shadow-black/60 p-3">
      <div className="text-[11px] font-extrabold text-text-strong truncate mb-2">{t.name}</div>

      {/* Vainqueur + son parcours */}
      <div className="flex items-center gap-2 mb-2.5 rounded-lg bg-gold/10 border border-gold/25 px-2 py-1.5">
        <span className="text-base leading-none">🏆</span>
        <Avatar login={s.winner} imageUrl={null} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-gold truncate">{s.winner}</span>
          <span className="block text-[9px] text-muted-2 uppercase tracking-wider">
            Vainqueur · {s.winnerWins} victoire{s.winnerWins > 1 ? 's' : ''}
          </span>
        </span>
      </div>

      {/* Arbre de qualif : demi-finales → finale */}
      {s.semis.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-wider text-muted font-bold mb-1">Demi-finales</div>
          <div className="space-y-1">
            {s.semis.map((m) => (
              <MatchLine key={m.id} m={m} />
            ))}
          </div>
        </div>
      )}
      {s.final && (
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-wider text-gold/80 font-bold mb-1">Finale</div>
          <MatchLine m={s.final} />
        </div>
      )}

      <div className="text-[9px] text-muted-2 text-center pt-1 border-t border-border/50">
        Cliquer pour voir le détail →
      </div>
    </div>
  );
}
