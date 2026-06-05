import { useCallback, useEffect, useState } from 'react';
import { Trophy, Swords } from 'lucide-react';
import {
  api,
  type BetsResponse,
  type MyBet,
  type OpenBetMatch,
  type OpenBetTournament,
  type PlaceBetInput,
} from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';
import { SectionHeader } from './shared/SectionHeader';

const BET_MULTIPLIER = 2;

function CoinAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <img src="/42coin.png" alt="" className="w-4 h-4" />
      {value}
    </span>
  );
}

/** Formulaire inline de placement de pari : choix d'un pronostic + mise. */
function BetForm({
  choices,
  maxStake,
  busy,
  onSubmit,
  onCancel,
}: {
  choices: string[];
  maxStake: number;
  busy: boolean;
  onSubmit: (choiceLogin: string, stake: number) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [choice, setChoice] = useState<string>('');
  const [stake, setStake] = useState<string>('');
  const stakeNum = Number(stake);
  const valid =
    !!choice && Number.isInteger(stakeNum) && stakeNum > 0 && stakeNum <= maxStake;

  return (
    <div className="mt-3 pt-3 border-t border-gold/10 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] font-extrabold text-muted-2 mb-2">
          {t('bets.chooseWinner')}
        </div>
        <div className="flex flex-wrap gap-2">
          {choices.map((login) => {
            const active = login === choice;
            return (
              <button
                key={login}
                type="button"
                onClick={() => setChoice(login)}
                className={`px-3 h-8 rounded-lg text-xs font-bold tap-transparent transition-colors ${
                  active
                    ? 'border border-gold/50 bg-gold/20 text-gold'
                    : 'border border-white/8 bg-white/[0.02] text-muted hover:text-text'
                }`}
              >
                @{login}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min={1}
            max={maxStake}
            inputMode="numeric"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder={t('bets.stake')}
            className="w-full h-9 rounded-xl bg-bg-2/80 border border-gold/15 px-3 text-sm text-text-strong tabular-nums outline-none focus:border-gold/40"
          />
        </div>
        {valid && (
          <span className="text-[11px] text-muted-2 shrink-0">
            {t('bets.potentialGain')}{' '}
            <CoinAmount value={stakeNum * BET_MULTIPLIER} className="text-gold font-bold" />
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 rounded-xl border border-white/8 bg-white/[0.02] text-muted-2 text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent"
        >
          {t('bets.cancel')}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => onSubmit(choice, stakeNum)}
          className={`flex-1 h-9 rounded-xl text-xs font-extrabold uppercase tracking-[0.14em] tap-transparent transition-colors ${
            valid && !busy
              ? 'border border-gold/40 bg-gold/15 text-gold hover:bg-gold/25'
              : 'border border-white/5 bg-white/[0.02] text-muted-2 cursor-not-allowed'
          }`}
        >
          {t('bets.confirm')}
        </button>
      </div>
    </div>
  );
}

function GameTag({ game }: { game: string | null }) {
  if (!game) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold bg-white/5 text-muted-2">
      {game}
    </span>
  );
}

function statusStyle(status: MyBet['status']): string {
  switch (status) {
    case 'won':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
    case 'lost':
      return 'border-red/25 bg-red/10 text-red';
    case 'refunded':
      return 'border-sky-400/25 bg-sky-400/10 text-sky-300';
    default:
      return 'border-gold/25 bg-gold/10 text-gold';
  }
}

export function BetsPanel() {
  const t = useT();
  const { refresh } = useLeagueData();
  const [data, setData] = useState<BetsResponse | null>(null);
  const [error, setError] = useState(false);
  const [openForm, setOpenForm] = useState<string | null>(null); // clé cible (tournoi/match)
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

  const placeBet = useCallback(
    async (input: PlaceBetInput) => {
      setPlacing(true);
      setFlash(null);
      try {
        await api.placeBet(input);
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

  const coins = data?.coins ?? 0;
  const hasOpen = !!data && (data.openTournaments.length > 0 || data.openMatches.length > 0);

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

          {/* Matchs ouverts aux paris */}
          {data.openMatches.length > 0 && (
            <section>
              <SectionHeader title={t('bets.openMatches')} />
              <div className="space-y-3 mt-2">
                {data.openMatches.map((m: OpenBetMatch) => {
                  const key = `m:${m.id}`;
                  return (
                    <div key={m.id} className="rounded-2xl border border-gold/15 bg-bg-1/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Swords className="w-4 h-4 text-gold shrink-0" strokeWidth={2.2} />
                          <span className="font-bold text-text-strong text-sm truncate">
                            @{m.playerALogin} <span className="text-muted-2">vs</span> @{m.playerBLogin}
                          </span>
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
                      <div className="text-[11px] text-muted-2 mt-1 flex items-center gap-2">
                        <span className="truncate">{m.tournamentName}</span>
                        <GameTag game={m.game} />
                        <span>· {t('bets.round')} {m.round}</span>
                      </div>
                      {openForm === key && (
                        <BetForm
                          choices={[m.playerALogin, m.playerBLogin]}
                          maxStake={coins}
                          busy={placing}
                          onCancel={() => setOpenForm(null)}
                          onSubmit={(choiceLogin, stake) =>
                            placeBet({
                              targetType: 'match',
                              tournamentId: m.tournamentId,
                              matchId: m.id,
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
              {data.myBets.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-bg-1/50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text-strong truncate">
                      {b.tournamentName ?? '—'}
                    </div>
                    <div className="text-[11px] text-muted-2 truncate">
                      {b.targetType === 'tournament' ? t('bets.tournamentWinner') : t('bets.openMatches')}{' '}
                      · {b.stake} {t('bets.on')} @{b.choiceLogin}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {b.status === 'won' && (
                      <CoinAmount value={b.payout} className="text-emerald-300 font-extrabold text-xs" />
                    )}
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider font-extrabold border ${statusStyle(
                        b.status,
                      )}`}
                    >
                      {t(`bets.status.${b.status}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
