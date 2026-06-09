import { useCallback, useEffect, useState } from 'react';
import { Swords, Trophy } from 'lucide-react';
import {
  api,
  type BetsResponse,
  type OpenBetTournament,
  type OpenOpsDuel,
  type PlaceBetInput,
  type PlaceOpsBetInput,
} from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';
import { SectionHeader } from './shared/SectionHeader';
import { BetForm, CoinAmount, GameTag, betStatusStyle } from '../../components/bets/BetPrimitives';

export function BetsPanel() {
  const t = useT();
  const { refresh } = useLeagueData();
  const [data, setData] = useState<BetsResponse | null>(null);
  const [error, setError] = useState(false);
  const [openForm, setOpenForm] = useState<string | null>(null); // clé cible (tournoi/duel)
  const [placing, setPlacing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .bets()
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Enrobage commun à un placement de pari (tournoi ou duel d'ops).
  const runPlace = useCallback(
    async (place: () => Promise<unknown>) => {
      setPlacing(true);
      setFlash(null);
      try {
        await place();
        setOpenForm(null);
        setFlash(t('bets.placed'));
        load();
        void refresh();
      } catch {
        setFlash(t('bets.error'));
      } finally {
        setPlacing(false);
      }
    },
    [load, refresh, t],
  );

  const placeBet = useCallback(
    (input: PlaceBetInput) => runPlace(() => api.placeBet(input)),
    [runPlace],
  );
  const placeOpsBet = useCallback(
    (input: PlaceOpsBetInput) => runPlace(() => api.placeOpsBet(input)),
    [runPlace],
  );

  const coins = data?.coins ?? 0;
  const hasOpen =
    !!data && (data.openTournaments.length > 0 || data.openOpsDuels.length > 0);

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1 px-1">
          <SectionHeader title={t('bets.title')} />
          <CoinAmount value={coins} className="text-gold font-extrabold" />
        </div>
        <p className="text-[12px] text-muted-2 px-1">{t('bets.subtitle')}</p>
      </div>

      {flash && (
        <div className="text-center text-xs font-bold text-gold bg-gold/10 border border-gold/20 rounded-xl py-2">
          {flash}
        </div>
      )}

      {error && <div className="text-center text-muted-2 py-8 text-sm">{t('bets.error')}</div>}
      {!error && !data && (
        <div className="text-center text-muted-2 py-8 text-sm">{t('bets.loading')}</div>
      )}

      {!error && data && (
        <>
          {/* Tournois ouverts aux paris */}
          {data.openTournaments.length > 0 && (
            <section>
              <SectionHeader title={t('bets.openTournaments')} />
              <div className="space-y-3 mt-2">
                {data.openTournaments.map((tour: OpenBetTournament) => {
                  const key = `t:${tour.id}`;
                  return (
                    <div key={tour.id} className="rounded-2xl border border-gold/15 bg-bg-1/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Trophy className="w-4 h-4 text-gold shrink-0" strokeWidth={2.2} />
                          <span className="font-extrabold text-text-strong text-sm truncate">
                            {tour.name}
                          </span>
                          <GameTag game={tour.game} />
                        </div>
                        {openForm !== key && (
                          <button
                            type="button"
                            onClick={() => setOpenForm(key)}
                            className="shrink-0 px-3 h-8 rounded-lg border border-gold/40 bg-gold/15 text-gold text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent hover:bg-gold/25"
                          >
                            {t('bets.placeBet')}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-2 mt-1">
                        {t('bets.tournamentWinner')} · {tour.entrants.length} 👥
                      </div>
                      {openForm === key && (
                        <BetForm
                          choices={tour.entrants}
                          maxStake={coins}
                          busy={placing}
                          onCancel={() => setOpenForm(null)}
                          onSubmit={(choiceLogin, stake) =>
                            placeBet({
                              targetType: 'tournament',
                              tournamentId: tour.id,
                              choiceLogin,
                              stake,
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Duels d'ops ouverts aux paris */}
          {data.openOpsDuels.length > 0 && (
            <section>
              <SectionHeader title={t('bets.openOpsDuels')} />
              <div className="space-y-3 mt-2">
                {data.openOpsDuels.map((duel: OpenOpsDuel) => {
                  const key = `o:${duel.id}`;
                  return (
                    <div key={duel.id} className="rounded-2xl border border-red/20 bg-bg-1/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Swords className="w-4 h-4 text-red shrink-0" strokeWidth={2.2} />
                          <span className="font-extrabold text-text-strong text-sm truncate">
                            @{duel.ownerLogin} <span className="text-muted-2">⚔️</span> @
                            {duel.targetLogin}
                          </span>
                        </div>
                        {openForm !== key && (
                          <button
                            type="button"
                            onClick={() => setOpenForm(key)}
                            className="shrink-0 px-3 h-8 rounded-lg border border-red/40 bg-red/15 text-red text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent hover:bg-red/25"
                          >
                            {t('bets.placeBet')}
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-2 mt-1">{t('bets.opsDuelWinner')}</div>
                      {openForm === key && (
                        <BetForm
                          choices={[duel.ownerLogin, duel.targetLogin]}
                          avatars={{
                            [duel.ownerLogin]: duel.ownerImageUrl,
                            [duel.targetLogin]: duel.targetImageUrl,
                          }}
                          maxStake={coins}
                          busy={placing}
                          onCancel={() => setOpenForm(null)}
                          onSubmit={(choiceLogin, stake) =>
                            placeOpsBet({ challengeId: duel.id, choiceLogin, stake })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {!hasOpen && (
            <div className="text-center text-muted-2 py-6 text-sm">{t('bets.noOpen')}</div>
          )}

          {/* Mes paris */}
          <section>
            <SectionHeader title={t('bets.myBets')} />
            <div className="mt-2 space-y-2">
              {data.myBets.length === 0 && (
                <div className="text-center text-muted-2 py-4 text-sm">{t('bets.noBets')}</div>
              )}
              {data.myBets.map((b) => {
                const isOps = b.targetType === 'ops';
                const title = isOps
                  ? `@${b.opsOwnerLogin ?? '?'} ⚔️ @${b.opsTargetLogin ?? '?'}`
                  : (b.tournamentName ?? '—');
                const kindLabel = isOps
                  ? t('bets.opsDuel')
                  : b.targetType === 'tournament'
                    ? t('bets.tournamentWinner')
                    : t('bets.openMatches');
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-bg-1/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-strong truncate">{title}</div>
                      <div className="text-[11px] text-muted-2 truncate">
                        {kindLabel} · {b.stake} {t('bets.on')} @{b.choiceLogin}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.status === 'won' && (
                        <CoinAmount
                          value={b.payout}
                          className="text-emerald-300 font-extrabold text-xs"
                        />
                      )}
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border ${betStatusStyle(
                          b.status,
                        )}`}
                      >
                        {t(`bets.status.${b.status}`)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
