import { useCallback, useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api, type MyBet, type PlaceBetInput, type Tournament } from '../../lib/api';
import { trackEvent } from '../../lib/analytics';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';
import { BetForm, CoinAmount, GameTag, betStatusStyle } from '../bets/BetPrimitives';

/** En-tête de section dorée, alignée sur le style de la page tournoi. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.16em] text-gold font-extrabold mb-3 flex items-center gap-2">
      <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
      {children}
    </div>
  );
}

/**
 * Onglet « Parier » d'un tournoi en cours. Réutilise la feature de paris (cote
 * fixe ×2, endpoints /bets) mais cadrée sur CE tournoi : on parie UNIQUEMENT sur
 * le vainqueur du tournoi (pas de pari match par match), et seulement AU DÉBUT —
 * dès qu'un match est confirmé, le marché se ferme. Les participants sont dérivés
 * du tournoi affiché (avec leur photo) ; le solde et mes paris viennent de GET
 * /bets. Les règles de validation restent côté serveur.
 */
export function TournamentBets({
  tournament,
  myLogin,
}: {
  tournament: Tournament;
  myLogin: string | null;
}) {
  const t = useT();
  const { refresh } = useLeagueData();
  const [coins, setCoins] = useState(0);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const loadBets = useCallback(() => {
    api
      .bets()
      .then((d) => {
        setCoins(d.coins);
        setMyBets(d.myBets.filter((b) => b.tournamentId === tournament.id));
      })
      .catch(() => {});
  }, [tournament.id]);

  // Recharge à l'ouverture et à chaque mise à jour du tournoi (un match qui se
  // joue n'est plus pariable → on resynchronise solde + mes paris).
  useEffect(() => {
    loadBets();
  }, [loadBets, tournament]);

  const placeBet = useCallback(
    async (input: PlaceBetInput) => {
      setPlacing(true);
      setFlash(null);
      try {
        await api.placeBet(input);
        trackEvent('bet.place');
        setOpenForm(null);
        setFlash(t('bets.placed'));
        loadBets();
        void refresh();
      } catch {
        setFlash(t('bets.error'));
      } finally {
        setPlacing(false);
      }
    },
    [loadBets, refresh, t],
  );

  const entries = tournament.entries ?? [];
  const entrants = entries.map((e) => e.login);
  // Map login → photo pour afficher la pp des participants dans le formulaire.
  const avatars = Object.fromEntries(entries.map((e) => [e.login, e.user?.imageUrl ?? null]));
  // On ne parie qu'AU DÉBUT du tournoi : dès qu'un match est confirmé (un premier
  // résultat est tombé), le marché se ferme. Même règle côté serveur (POST /bets).
  const hasResult = (tournament.matches ?? []).some((m) => m.confirmedAt);
  const winnerKnown = !!tournament.winnerLogin;
  // Un participant ne peut pas parier sur son propre tournoi (refus serveur 403).
  const iAmEntrant = !!myLogin && entrants.includes(myLogin);
  const canBetWinner = !winnerKnown && !hasResult && !iAmEntrant && entrants.length > 0;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-2">{t('bets.subtitle')}</p>
        <CoinAmount value={coins} className="text-gold font-extrabold" />
      </div>

      {flash && (
        <div className="text-center text-xs font-bold text-gold bg-gold/10 border border-gold/20 rounded-xl py-2">
          {flash}
        </div>
      )}

      {/* Pari sur le vainqueur du tournoi — l'unique pari possible, ouvert
          seulement tant qu'aucun match n'a livré de résultat. */}
      <section>
        <SectionTitle>{t('bets.tournamentWinner')}</SectionTitle>
        <div className="rounded-2xl border border-gold/15 bg-bg-1/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-gold shrink-0" strokeWidth={2.2} />
              <span className="font-extrabold text-text-strong text-sm truncate">{tournament.name}</span>
              <GameTag game={tournament.game ?? null} />
            </div>
            {canBetWinner && openForm !== 'winner' && (
              <button
                type="button"
                onClick={() => setOpenForm('winner')}
                className="shrink-0 px-3 h-8 rounded-lg border border-gold/40 bg-gold/15 text-gold text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent hover:bg-gold/25"
              >
                {t('bets.placeBet')}
              </button>
            )}
          </div>
          <div className="text-[11px] text-muted-2 mt-1">{entrants.length} 👥</div>
          {canBetWinner && (
            <p className="text-[11px] text-gold/80 mt-2 leading-snug">
              {t('bets.progressiveNote').replace('{mult}', String(tournament.betFinalMult ?? 2))}
            </p>
          )}
          {canBetWinner ? (
            openForm === 'winner' && (
              <BetForm
                choices={entrants}
                avatars={avatars}
                maxStake={coins}
                busy={placing}
                onCancel={() => setOpenForm(null)}
                onSubmit={(choiceLogin, stake) =>
                  placeBet({
                    targetType: 'tournament',
                    tournamentId: tournament.id,
                    choiceLogin,
                    stake,
                  })
                }
              />
            )
          ) : (
            <div className="mt-3 pt-3 border-t border-gold/10 text-[12px] text-muted-2">
              {iAmEntrant
                ? t('bets.ownTournament')
                : winnerKnown
                  ? t('bets.tournamentOver')
                  : t('bets.closedStarted')}
            </div>
          )}
        </div>
      </section>

      {/* Mes paris sur ce tournoi */}
      <section>
        <SectionTitle>{t('bets.myBets')}</SectionTitle>
        {myBets.length === 0 ? (
          <div className="text-center text-muted-2 py-4 text-sm">{t('bets.noBets')}</div>
        ) : (
          <div className="space-y-2">
            {myBets.map((bet) => (
              <div
                key={bet.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-bg-1/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text-strong truncate">
                    {bet.targetType === 'tournament' ? t('bets.tournamentWinner') : t('bets.openMatches')}
                  </div>
                  <div className="text-[11px] text-muted-2 truncate">
                    {bet.stake} {t('bets.on')} @{bet.choiceLogin}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {bet.status === 'won' && (
                    <CoinAmount value={bet.payout} className="text-emerald-300 font-extrabold text-xs" />
                  )}
                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border ${betStatusStyle(
                      bet.status,
                    )}`}
                  >
                    {t(`bets.status.${bet.status}`)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
