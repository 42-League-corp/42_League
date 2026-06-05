import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGameAdvantage } from '@42-league/shared';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
import { AbacusSlider } from '../components/AbacusSlider';
import { OutcomeButton } from '../components/OutcomeButton';
import { api, type Game, type Tournament, type TournamentMatch, type TournamentInvite, type LeaderboardEntry } from '../lib/api';
import { PlayerSearch } from './defis/shared/PlayerSearch';
import BracketTree from '../components/tournois/BracketTree';
import CoinFlip from '../components/tournois/CoinFlip';
import { CoinFlipOverlay } from '../components/tournois/CoinFlipOverlay';
import AdvantagePicker from '../components/tournois/AdvantagePicker';
import TournamentLaunchCeremony from '../components/tournois/TournamentLaunchCeremony';
import { TournamentBets } from '../components/tournois/TournamentBets';
import { RankingScopeToggle } from './leaderboard/RankingScopeToggle';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useServerEvents } from '../hooks/useServerEvents';
import { useT } from '../lib/i18n';

// Accent par jeu pour la cérémonie / le bracket (mêmes teintes que le reste de l'app).
const GAME_ACCENT: Record<Game, string> = {
  babyfoot: '#ffc94a',
  smash: '#ff4d5c',
  chess: '#56c46e',
  streetfighter: '#ff7a18',
  flechettes: '#14b8a6',
};
function gameAccent(game: Game | null | undefined): string {
  return (game && GAME_ACCENT[game]) || '#ffc94a';
}

const STATUS_KEY: Record<Tournament['status'], string> = {
  registration: 'tournois.status.registration',
  in_progress: 'tournois.status.in_progress',
  finished: 'tournois.status.finished',
  cancelled: 'tournois.status.cancelled',
};

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = WINNING_SCORE - 1;

export function TournoiDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ?? '';
  const { me, leaderboard, locations } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const t = useT();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitee, setInvitee] = useState<LeaderboardEntry | null>(null);
  // Cérémonie de lancement : déclenchée une fois au passage registration→in_progress.
  const [showCeremony, setShowCeremony] = useState(false);
  // Onglet de la vue d'un tournoi en cours : bracket/poules ou paris.
  const [detailTab, setDetailTab] = useState<'bracket' | 'bets'>('bracket');
  const prevStatusRef = useRef<Tournament['status'] | null>(null);

  // `silent` : refresh en arrière-plan (SSE / retour de focus) qui swap les données
  // SANS repasser par l'écran de chargement plein écran — sinon la page entière
  // « recharge » à la moindre mutation. Le skeleton n'apparaît qu'au 1er chargement
  // (ou quand on change de tournoi).
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const fresh = await api.tournament(id);
      // Détecte la transition registration → in_progress pendant qu'on est sur la page.
      if (prevStatusRef.current === 'registration' && fresh.status === 'in_progress') {
        setShowCeremony(true);
      }
      prevStatusRef.current = fresh.status;
      setTournament(fresh);
    } catch {
      if (!silent) setTournament(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh déclenché par les ACTIONS (toss, choix d'avantage, saisie de score,
  // confirmation…) : silencieux lui aussi, sinon chaque clic recharge toute la
  // page et démonte l'animation (pile-ou-face) en cours.
  const refreshSilent = useCallback(() => load(true), [load]);

  // Rafraîchit la page en temps réel quand une mise à jour de tournoi ou une
  // invitation est reçue (accept, decline, nouveau joueur, démarrage…). Refresh
  // SILENCIEUX : on garde l'affichage courant et on swap les données en place.
  useServerEvents(refreshSilent, ['tournament:update', 'tournament:invite', 'tournament:invite_declined']);

  if (loading) {
    return (
      <Panel title={t('tournois.detail.tournament')} sub="…">
        <BackLink />
        <div className="text-center text-muted-2 py-10">{t('tournois.detail.loading')}</div>
      </Panel>
    );
  }
  if (!tournament) {
    return (
      <Panel title={t('tournois.detail.tournament')} sub={t('tournois.detail.notFoundSub')}>
        <BackLink />
        <div className="text-center text-muted-2 py-10">{t('tournois.detail.notFound')}</div>
      </Panel>
    );
  }

  const myLogin = me?.login;
  const isOrganizer = tournament.createdByLogin === myLogin;
  const isAdmin = !!me?.isAdmin;
  const iAmIn = !!tournament.entries?.some((e) => e.login === myLogin);
  const entriesCount = tournament.entries?.length ?? 0;
  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    try {
      await action();
      flash.show(successMsg);
      await load(true); // refresh silencieux : pas de rechargement plein écran à chaque action
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const entryLogins = new Set((tournament.entries ?? []).map((e) => e.login));
  // Joueurs déjà invités (invitation en attente) → on les exclut de la liste invitable.
  const pendingInviteeLogins = new Set(
    (tournament.invites ?? []).filter((i) => i.status === 'pending').map((i) => i.inviteeLogin),
  );
  const invitable = leaderboard
    .filter((u) => !entryLogins.has(u.login) && !pendingInviteeLogins.has(u.login))
    .sort((a, b) => a.login.localeCompare(b.login));
  const invitableCounts = Object.fromEntries(invitable.map((u) => [u.login, u.matchesPlayed]));

  // Mon invitation en attente (si j'ai été invité mais pas encore décidé).
  const myPendingInvite = (tournament.invites ?? []).find(
    (i) => i.inviteeLogin === myLogin && i.status === 'pending',
  );

  const handleSendInvite = async () => {
    if (!invitee) return;
    const login = invitee.login;
    setInvitee(null);
    await runAction(
      () => api.inviteTournamentPlayer(tournament.id, login),
      t('tournois.flash.inviteSent').replace('{login}', login),
    );
  };

  const handleAcceptInvite = async (invite: TournamentInvite) => {
    await runAction(
      () => api.acceptTournamentInvite(tournament.id, invite.id),
      t('tournois.flash.joined'),
    );
  };

  const handleDeclineInvite = async (invite: TournamentInvite) => {
    await runAction(
      () => api.declineTournamentInvite(tournament.id, invite.id),
      t('tournois.flash.inviteDeclined'),
    );
  };

  const kindLabel = tournament.kind === 'official' ? t('tournois.detail.kind.official') : t('tournois.detail.kind.friendly');
  const visLabel = tournament.isPrivate ? t('tournois.detail.private') : '';
  const formatLabel = tournament.format === 'pools' ? t('tournois.detail.pools') : '';
  const sub = `${kindLabel}${visLabel}${formatLabel} · ${entriesCount}/${tournament.capacity} · ${t(STATUS_KEY[tournament.status])}`;

  const handleLeave = async () => {
    const ok = await confirm({
      title: t('tournois.confirm.leave.title'),
      message: t('tournois.confirm.leave.message'),
      confirmLabel: t('tournois.confirm.leave.confirm'),
      cancelLabel: t('tournois.confirm.leave.cancel'),
      danger: true,
    });
    if (!ok) return;
    await runAction(() => api.leaveTournament(tournament.id), t('tournois.flash.leftReg'));
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: t('tournois.confirm.cancel.title'),
      message: t('tournois.confirm.cancel.message'),
      warning: t('tournois.confirm.cancel.warning'),
      confirmLabel: t('tournois.confirm.cancel.confirm'),
      cancelLabel: t('tournois.confirm.cancel.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.cancelTournament(tournament.id);
      flash.show(t('tournois.flash.deleted'));
      navigate('/tournaments');
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Panel title={tournament.name} sub={sub}>
      <BackLink />

      {/* Cérémonie médiévale au lancement (registration → in_progress). */}
      {showCeremony && (
        <TournamentLaunchCeremony
          tournamentName={tournament.name}
          participants={(tournament.entries ?? []).map((e) => ({
            login: e.login,
            imageUrl: e.user?.imageUrl ?? null,
          }))}
          accent={gameAccent(tournament.game)}
          onDone={() => setShowCeremony(false)}
          t={t}
        />
      )}

      {/* Récompense (tournois officiels) — visible à tous, indique l'enjeu. */}
      {tournament.kind === 'official' && !!tournament.prizeKind && tournament.prizeKind !== 'none' && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl border border-gold/30 bg-gold/[0.06]">
          <span className="text-2xl leading-none">🎁</span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gold font-extrabold">
              {t(tournament.status === 'finished' ? 'tournois.detail.prize.won' : 'tournois.detail.prize.label')}
            </div>
            <div className="text-sm font-bold text-text-strong flex items-center gap-1.5 flex-wrap">
              {tournament.prizeKind === 'coins' ? (
                <>
                  <img src="/42coin.png" alt="" className="w-4 h-4" />
                  {t('tournois.detail.prize.coins').replace('{n}', String(tournament.prizeCoins ?? 0))}
                </>
              ) : tournament.prizeItem ? (
                <>
                  {tournament.prizeItem.name}
                  <span className="text-[10px] uppercase tracking-wider text-muted-2 font-bold">
                    ({tournament.prizeItem.category})
                  </span>
                </>
              ) : (
                t('tournois.field.prize')
              )}
            </div>
          </div>
        </div>
      )}

      {tournament.status === 'registration' && (
        <>
          {tournament.isPrivate && !iAmIn && !isOrganizer && !isAdmin && (
            <div className="mb-4 text-[11px] text-teal flex items-center gap-1.5 uppercase tracking-wider font-semibold">
              {t('tournois.detail.privateNotice')}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {!iAmIn && entriesCount < tournament.capacity &&
              (!tournament.isPrivate || isOrganizer || isAdmin) && (
              <Button onClick={() => runAction(() => api.joinTournament(tournament.id), t('tournois.flash.registered'))}>
                {t('tournois.detail.join')}
              </Button>
            )}
            {iAmIn && (
              <Button variant="ghost" onClick={handleLeave}>{t('tournois.detail.leave')}</Button>
            )}
            {isOrganizer && entriesCount === tournament.capacity && (
              <Button onClick={() => runAction(() => api.startTournament(tournament.id), t('tournois.flash.started'))}>
                {t('tournois.detail.start')}
              </Button>
            )}
            {(isOrganizer || isAdmin) && (
              <Button variant="danger" onClick={handleCancel}>{t('tournois.detail.delete')}</Button>
            )}
          </div>

          {/* Bannière : invitation reçue en attente de décision */}
          {myPendingInvite && !iAmIn && (
            <div className="mb-4 p-4 rounded-xl border border-gold/40 bg-gold/[0.06]">
              <div className="text-sm font-extrabold text-gold mb-1">
                {t('tournois.detail.invited.title')}
              </div>
              <div className="text-xs text-muted-2 mb-3">
                {t('tournois.detail.invited.by')} <span className="font-semibold text-text-strong">{myPendingInvite.inviterLogin}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAcceptInvite(myPendingInvite)} className="flex-1">
                  {t('tournois.detail.invited.join')}
                </Button>
                <Button variant="ghost" onClick={() => handleDeclineInvite(myPendingInvite)} className="flex-1 text-red border-red/30">
                  {t('tournois.detail.invited.decline')}
                </Button>
              </div>
            </div>
          )}

          {/* Section invitation (organisateur / admin) */}
          {(isOrganizer || isAdmin) && entriesCount < tournament.capacity && (
            <div className="mb-4 p-3 rounded-xl border border-gold/20 bg-bg-2/30">
              <div className="text-[10px] uppercase tracking-wider text-gold font-extrabold mb-2">
                {t('tournois.detail.invite.title')}
              </div>
              {invitable.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <PlayerSearch
                    players={invitable}
                    recentPlayers={[]}
                    opponentCounts={invitableCounts}
                    selected={invitee}
                    onSelect={setInvitee}
                    onClear={() => setInvitee(null)}
                    locations={locations}
                  />
                  <Button onClick={handleSendInvite} disabled={!invitee}>
                    {invitee ? t('tournois.detail.invite.send').replace('{login}', invitee.login) : t('tournois.detail.invite.sendGeneric')}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-2">{t('tournois.detail.invite.allInvited')}</p>
              )}
              <p className="text-[10px] text-muted mt-1.5">
                {t('tournois.detail.invite.notice')}
              </p>

              {/* Invitations en attente (vue organisateur) */}
              {(tournament.invites ?? []).filter((i) => i.status === 'pending').length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                    {t('tournois.detail.invite.pending')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(tournament.invites ?? [])
                      .filter((i) => i.status === 'pending')
                      .map((inv) => (
                        <span
                          key={inv.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-1 border border-border text-[11px] text-muted-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gold/70 animate-pulse" />
                          {inv.inviteeLogin}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
            {t('tournois.detail.entrants')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(tournament.entries ?? []).map((e) => (
              <div
                key={e.login}
                className="flex items-center gap-2.5 p-2.5 border border-border bg-bg-2/40 rounded"
              >
                <PlayerLink login={e.login} className="flex-1 min-w-0">
                  <Avatar login={e.login} imageUrl={e.user?.imageUrl ?? null} size="md" />
                  <div className="min-w-0">
                    <div className="font-bold truncate text-text-strong">{e.login}</div>
                    <div className="text-[11px] text-muted-2">
                      <span className="text-teal font-bold">{e.user?.elo ?? '—'}</span> ELO
                    </div>
                  </div>
                </PlayerLink>
              </div>
            ))}
            {Array.from({ length: tournament.capacity - entriesCount }).map((_, i) => (
              <div
                key={`slot-${i}`}
                className="flex items-center gap-2.5 p-2.5 border border-dashed border-muted/40 bg-bg-2/20 rounded opacity-50"
              >
                <div className="w-11 h-11 rounded-full border border-dashed border-muted flex items-center justify-center text-muted text-lg font-bold">
                  ?
                </div>
                <div className="text-muted text-sm font-semibold">{t('tournois.detail.freeSlot')}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tournament.status !== 'registration' && (
        <>
          {tournament.winner && tournament.status === 'finished' && (
            <div className="border border-gold/40 bg-gold/5 rounded p-5 mb-6 text-center">
              <div className="text-gold text-xs uppercase tracking-[0.18em] font-extrabold mb-3">
                {t('tournois.detail.winner')}
              </div>
              <PlayerLink login={tournament.winner.login} className="inline-flex flex-col gap-2 text-base">
                <Avatar login={tournament.winner.login} imageUrl={tournament.winner.imageUrl ?? null} size="lg" />
                <span className="font-extrabold text-text-strong">{tournament.winner.login}</span>
              </PlayerLink>
            </div>
          )}

          {/* Onglets (tournoi en cours) : suivre le bracket ou parier. */}
          {tournament.status === 'in_progress' && (
            <div className="mb-5 max-w-xs">
              <RankingScopeToggle<'bracket' | 'bets'>
                value={detailTab}
                onChange={setDetailTab}
                choices={[
                  { value: 'bracket', label: t('tournois.tab.bracket') },
                  { value: 'bets', label: t('tournois.tab.bets') },
                ]}
              />
            </div>
          )}

          {tournament.status === 'in_progress' && detailTab === 'bets' ? (
            <TournamentBets tournament={tournament} myLogin={myLogin ?? null} />
          ) : (
            <PoolsAndBracket tournament={tournament} myLogin={myLogin ?? null} onChange={refreshSilent} />
          )}

          {tournament.status === 'in_progress' &&
            detailTab === 'bracket' &&
            (isOrganizer || isAdmin) && (
              <div className="mt-6 pt-4 border-t border-border/40 flex justify-end">
                <Button size="sm" variant="danger" onClick={handleCancel}>
                  {t('tournois.detail.deleteTournament')}
                </Button>
              </div>
            )}
        </>
      )}
    </Panel>
  );
}

function BackLink() {
  const t = useT();
  return (
    <Link
      to="/tournaments"
      className="inline-block text-[11px] uppercase tracking-wider text-muted-2 hover:text-teal mb-3"
    >
      {t('tournois.detail.back')}
    </Link>
  );
}

interface Standing {
  login: string;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
}

// Classement d'une poule (miroir de poolStandings côté serveur) : victoires, puis
// différence de buts, puis buts marqués.
function computeStandings(matches: TournamentMatch[]): Standing[] {
  const table = new Map<string, Standing>();
  const ensure = (login: string): Standing => {
    let s = table.get(login);
    if (!s) {
      s = { login, played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0, diff: 0 };
      table.set(login, s);
    }
    return s;
  };
  for (const m of matches) {
    if (!m.playerALogin || !m.playerBLogin || m.scoreA == null || m.scoreB == null) continue;
    const a = ensure(m.playerALogin);
    const b = ensure(m.playerBLogin);
    a.played++;
    b.played++;
    a.goalsFor += m.scoreA;
    a.goalsAgainst += m.scoreB;
    b.goalsFor += m.scoreB;
    b.goalsAgainst += m.scoreA;
    if (m.winnerLogin === m.playerALogin) a.wins++;
    else if (m.winnerLogin === m.playerBLogin) b.wins++;
  }
  const rows = [...table.values()];
  for (const r of rows) r.diff = r.goalsFor - r.goalsAgainst;
  rows.sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.goalsFor - x.goalsFor);
  return rows;
}

const QUALIFY_PER_POOL = 2;

function PoolsAndBracket({
  tournament,
  myLogin,
  onChange,
}: {
  tournament: Tournament;
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  const t = useT();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const { poolGroups, bracketMatchesFlat, totalBracketRounds, poolsComplete } = useMemo(() => {
    const all = tournament.matches ?? [];
    const poolMatches = all.filter((m) => m.stage === 'pool');
    const bracketMatches = all.filter((m) => (m.stage ?? 'bracket') === 'bracket');

    // Poules regroupées par index.
    const byPool = new Map<number, TournamentMatch[]>();
    for (const m of poolMatches) {
      const p = m.poolIndex ?? 0;
      const arr = byPool.get(p) ?? [];
      arr.push(m);
      byPool.set(p, arr);
    }
    const groups = [...byPool.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([index, matches]) => ({
        index,
        matches: [...matches].sort((a, b) => a.slot - b.slot),
        standings: computeStandings(matches),
      }));
    const complete = poolMatches.length > 0 && poolMatches.every((m) => m.confirmedAt);

    // Bracket : nombre de rounds = round max réel (byes/poules font diverger la capacité).
    const total = bracketMatches.reduce((mx, m) => Math.max(mx, m.round), 0);

    return {
      poolGroups: groups,
      bracketMatchesFlat: bracketMatches,
      totalBracketRounds: total,
      poolsComplete: complete,
    };
  }, [tournament.matches]);

  const hasPools = poolGroups.length > 0;
  const hasBracket = totalBracketRounds > 0;
  // Match sélectionné dans l'arbre (détail + duel/saisie en dessous).
  const selectedMatch = useMemo(
    () => bracketMatchesFlat.find((m) => m.id === selectedMatchId) ?? null,
    [bracketMatchesFlat, selectedMatchId],
  );

  return (
    <div className="space-y-6">
      {hasPools && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.16em] text-gold font-extrabold mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
            {t('tournois.bracket.poolPhase')}
            <span className="text-muted-2 normal-case font-mono">
              {t('tournois.bracket.poolQualify').replace('{n}', String(QUALIFY_PER_POOL))}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {poolGroups.map((g) => (
              <PoolCard
                key={g.index}
                tournament={tournament}
                pool={g}
                myLogin={myLogin}
                onChange={onChange}
              />
            ))}
          </div>
          {!poolsComplete && (
            <p className="text-[11px] text-muted-2 mt-3">
              {t('tournois.bracket.poolPending')}
            </p>
          )}
        </section>
      )}

      {hasBracket ? (
        <section>
          {hasPools && (
            <div className="text-[10px] uppercase tracking-[0.16em] text-teal font-extrabold mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-teal to-teal rounded-sm" />
              {t('tournois.bracket.finalPhase')}
            </div>
          )}

          {/* Arbre visuel (vue d'ensemble cliquable). */}
          <BracketTree
            matches={bracketMatchesFlat}
            rounds={totalBracketRounds}
            entries={tournament.entries ?? []}
            onSelectMatch={(m) => setSelectedMatchId((cur) => (cur === m.id ? null : m.id))}
            selectedMatchId={selectedMatchId}
          />

          {/* Détail du match sélectionné : duel (toss → avantage) puis saisie du score. */}
          {selectedMatch && (
            <div className="mt-4 max-w-md mx-auto">
              {/* key={id} : remonte le composant à chaque match sélectionné pour
                  que l'état local (flipping du pile-ou-face) ne fuite pas d'un match à l'autre. */}
              <BracketMatch
                key={selectedMatch.id}
                tournament={tournament}
                match={selectedMatch}
                myLogin={myLogin}
                onChange={onChange}
              />
            </div>
          )}
        </section>
      ) : (
        !hasPools && (
          <div className="text-center text-muted-2 py-8 text-sm">{t('tournois.bracket.preparing')}</div>
        )
      )}
    </div>
  );
}

function PoolCard({
  tournament,
  pool,
  myLogin,
  onChange,
}: {
  tournament: Tournament;
  pool: { index: number; matches: TournamentMatch[]; standings: Standing[] };
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  const t = useT();
  const poolName = String.fromCharCode(65 + pool.index); // A, B, C…
  return (
    <div className="rounded-xl border border-border bg-bg-2/30 overflow-hidden">
      <div className="px-3 py-2 bg-bg-2/60 border-b border-border/50 text-[11px] font-extrabold uppercase tracking-wider text-text-strong">
        {t('tournois.pool.name').replace('{name}', poolName)}
      </div>
      {/* Classement */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-2 border-b border-border/40">
            <th className="text-left font-semibold py-1.5 pl-3">#</th>
            <th className="text-left font-semibold py-1.5">{t('tournois.pool.col.player')}</th>
            <th className="text-center font-semibold py-1.5">{t('tournois.pool.col.played')}</th>
            <th className="text-center font-semibold py-1.5">{t('tournois.pool.col.wins')}</th>
            <th className="text-center font-semibold py-1.5 pr-3">{t('tournois.pool.col.diff')}</th>
          </tr>
        </thead>
        <tbody>
          {pool.standings.map((s, i) => {
            const qualified = i < QUALIFY_PER_POOL;
            return (
              <tr
                key={s.login}
                className={`border-b border-border/20 last:border-0 ${
                  qualified ? 'bg-teal/5' : ''
                }`}
              >
                <td className="py-1.5 pl-3">
                  <span
                    className={`inline-flex w-4 justify-center font-bold ${
                      qualified ? 'text-teal' : 'text-muted-2'
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="py-1.5">
                  <PlayerLink login={s.login} className="text-sm truncate">
                    <span className={qualified ? 'text-text-strong font-semibold' : ''}>
                      {s.login}
                    </span>
                  </PlayerLink>
                </td>
                <td className="py-1.5 text-center tabular-nums text-muted-2">{s.played}</td>
                <td className="py-1.5 text-center tabular-nums font-bold">{s.wins}</td>
                <td className="py-1.5 text-center tabular-nums pr-3">
                  <span className={s.diff > 0 ? 'text-[#7fd66e]' : s.diff < 0 ? 'text-red' : ''}>
                    {s.diff > 0 ? `+${s.diff}` : s.diff}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Matchs de la poule */}
      <div className="p-2.5 space-y-2 border-t border-border/40">
        {pool.matches.map((m) => (
          <BracketMatch
            key={m.id}
            tournament={tournament}
            match={m}
            myLogin={myLogin}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function BracketMatch({
  tournament,
  match,
  myLogin,
  onChange,
}: {
  tournament: Tournament;
  match: TournamentMatch;
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  const flash = useFlash();
  const confirm = useConfirm();
  const t = useT();
  const [recording, setRecording] = useState(false);
  // Pile-ou-face : true entre le clic et l'arrivée du résultat (via reload SSE).
  const [flipping, setFlipping] = useState(false);
  // Révélation différée de l'étape « avantage » : on laisse la pièce se poser et
  // on garde le résultat du tirage à l'écran un instant avant d'enchaîner (sinon
  // le passage à l'étape suivante est trop brutal). True d'emblée si le toss était
  // déjà tranché au montage (revisite) → pas de délai artificiel.
  const [revealAdvantage, setRevealAdvantage] = useState(() => match.tossWinnerLogin != null);

  const winnerA = !!(match.winnerLogin && match.winnerLogin === match.playerALogin);
  const winnerB = !!(match.winnerLogin && match.winnerLogin === match.playerBLogin);
  const iAmIn = !!(myLogin && (match.playerALogin === myLogin || match.playerBLogin === myLogin));
  const recorded = match.recordedByLogin != null && match.scoreA != null && match.scoreB != null;
  const iRecorded = recorded && match.recordedByLogin === myLogin;

  const canRecord =
    tournament.status === 'in_progress' &&
    iAmIn &&
    !!match.playerALogin &&
    !!match.playerBLogin &&
    !match.confirmedAt;

  // ── Duel (toss → avantage) : uniquement pour les matchs de bracket prêts ──────
  const isBracket = (match.stage ?? 'bracket') === 'bracket';
  const tossDone = match.tossWinnerLogin != null;
  const advantageDone = match.advantagePick != null;
  // Le duel précède la saisie : on l'affiche tant que le toss/avantage n'est pas réglé.
  const duelPending = isBracket && canRecord && !recorded && !advantageDone;
  const iAmTossWinner = !!(myLogin && match.tossWinnerLogin === myLogin);
  const opponentLogin =
    myLogin === match.playerALogin ? match.playerBLogin : match.playerALogin;
  const advantage = getGameAdvantage(tournament.game ?? 'babyfoot');
  const tossWinnerName = match.tossWinnerLogin ?? '';

  // Une fois le résultat du tirage arrivé, on coupe l'animation de la pièce, on
  // la laisse atterrir (~0.6 s) puis on souffle sur le résultat avant de dévoiler
  // l'étape suivante (choix d'avantage).
  useEffect(() => {
    if (!tossDone) return;
    setFlipping(false);
    const tm = setTimeout(() => setRevealAdvantage(true), 2000);
    return () => clearTimeout(tm);
  }, [tossDone]);

  const handleToss = async () => {
    setFlipping(true);
    try {
      await api.tossTournamentMatch(tournament.id, match.id);
      // Le résultat partagé arrive via le reload (SSE tournament:update) ;
      // on rafraîchit aussi explicitement pour l'initiateur.
      await onChange();
    } catch (err) {
      setFlipping(false);
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handlePickAdvantage = async (pick: string) => {
    try {
      await api.pickTournamentAdvantage(tournament.id, match.id, pick);
      await onChange();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleRecordSubmit = async (scoreA: number, scoreB: number) => {
    try {
      await api.recordTournamentMatch(tournament.id, match.id, scoreA, scoreB);
      flash.show(t('tournois.flash.scoreRecorded'));
      setRecording(false);
      await onChange();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleConfirm = async () => {
    // Narrowing safe : on rentre ici uniquement quand `recorded` est true.
    if (match.scoreA == null || match.scoreB == null) return;
    try {
      const res = await api.confirmTournamentMatch(tournament.id, match.id, match.scoreA, match.scoreB);
      flash.show(
        res.finished
          ? t('tournois.flash.tournamentWon').replace('{login}', String(res.winnerLogin))
          : t('tournois.flash.scoreConfirmed'),
      );
      await onChange();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleReject = async () => {
    const ok = await confirm({
      title: t('tournois.confirm.reject.title'),
      message: t('tournois.confirm.reject.message'),
      confirmLabel: t('tournois.confirm.reject.confirm'),
      cancelLabel: t('tournois.confirm.reject.cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.rejectTournamentMatch(tournament.id, match.id);
      flash.show(t('tournois.flash.scoreReset'));
      await onChange();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <div
      className={`p-2.5 border rounded bg-bg-2/50 ${
        match.confirmedAt ? 'border-teal/40' : 'border-border'
      }`}
    >
      <PlayerRow login={match.playerALogin} score={match.scoreA} winner={winnerA} />
      <PlayerRow login={match.playerBLogin} score={match.scoreB} winner={winnerB} />

      {/* ── Duel : pile-ou-face partagé, puis choix de l'avantage ──
          Le LANCER (rotation + annonce du résultat) s'affiche EN GRAND, centré
          sur toute la page, via CoinFlipOverlay — il reste jusqu'à ce que le
          résultat soit annoncé. Ici, en inline, on ne garde que le bouton
          d'initiation (avant le lancer) et le choix d'avantage (après). */}
      {duelPending && (
        <div className="mt-2 pt-2 border-t border-border/40">
          {!tossDone && !flipping && (
            <CoinFlip
              side={match.tossSide ?? null}
              flipping={false}
              onFlip={handleToss}
              t={t}
            />
          )}
          {tossDone && revealAdvantage && (
            <AdvantagePicker
              advantage={advantage}
              isWinner={iAmTossWinner}
              pick={match.advantagePick ?? null}
              opponentName={(iAmTossWinner ? opponentLogin : match.tossWinnerLogin) ?? '?'}
              onPick={handlePickAdvantage}
              t={t}
            />
          )}
        </div>
      )}

      {/* Cinématique plein écran du pile-ou-face : ouverte pendant la rotation
          puis l'annonce du gagnant, fermée quand on enchaîne sur l'avantage. */}
      <CoinFlipOverlay
        open={duelPending && (flipping || (tossDone && !revealAdvantage))}
        side={match.tossSide ?? null}
        flipping={flipping}
        winnerName={tossWinnerName || undefined}
        t={t}
      />

      {/* Récap de l'avantage choisi, juste avant la saisie du score. */}
      {isBracket && advantageDone && canRecord && !recorded && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <AdvantagePicker
            advantage={advantage}
            isWinner={iAmTossWinner}
            pick={match.advantagePick ?? null}
            opponentName={(iAmTossWinner ? opponentLogin : match.tossWinnerLogin) ?? '?'}
            onPick={handlePickAdvantage}
            t={t}
          />
        </div>
      )}

      {canRecord && !duelPending && !recorded && !recording && (
        // Clignote / pulse quelques fois à l'arrivée sur la page pour attirer
        // l'attention sur la saisie du résultat, puis se stabilise.
        <motion.div
          className="mt-2 rounded-lg"
          initial={{ boxShadow: '0 0 0 0 rgba(255,201,74,0)' }}
          animate={{
            scale: [1, 1.04, 1, 1.04, 1, 1.04, 1],
            boxShadow: [
              '0 0 0 0 rgba(255,201,74,0)',
              '0 0 18px 2px rgba(255,201,74,0.65)',
              '0 0 0 0 rgba(255,201,74,0)',
              '0 0 18px 2px rgba(255,201,74,0.65)',
              '0 0 0 0 rgba(255,201,74,0)',
              '0 0 18px 2px rgba(255,201,74,0.65)',
              '0 0 0 0 rgba(255,201,74,0)',
            ],
          }}
          transition={{ duration: 1.8, ease: 'easeInOut', times: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 1] }}
        >
          <Button size="sm" full onClick={() => setRecording(true)}>
            {t('tournois.match.enterScore')}
          </Button>
        </motion.div>
      )}

      {canRecord && recording && (
        <RecordBracketForm
          match={match}
          game={tournament.game ?? 'babyfoot'}
          onSubmit={handleRecordSubmit}
          onCancel={() => setRecording(false)}
        />
      )}

      {canRecord && recorded && iRecorded && (
        <div className="text-[11px] text-muted-2 mt-2 text-center">
          {t('tournois.match.waitingConfirm').replace('{score}', `${match.scoreA}-${match.scoreB}`)}
        </div>
      )}

      {canRecord && recorded && !iRecorded && (
        <div className="mt-2">
          <div className="text-[11px] text-gold mb-1.5">
            {t('tournois.match.scoreToConfirm').replace('{score}', `${match.scoreA}-${match.scoreB}`)}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleConfirm}>{t('tournois.match.confirm')}</Button>
            <Button size="sm" variant="ghost" onClick={handleReject}>{t('tournois.match.reject')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({
  login,
  score,
  winner,
}: {
  login: string | null;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 py-1.5 px-1 border-b border-border/40 last:border-0 ${
        winner ? 'text-text-strong font-bold' : 'text-text'
      }`}
    >
      {login ? (
        <PlayerLink login={login} className="text-sm truncate min-w-0">
          <Avatar login={login} imageUrl={null} size="xs" />
          <span className="truncate">{login}</span>
        </PlayerLink>
      ) : (
        <span className="text-sm text-muted">?</span>
      )}
      <span className={`text-sm tabular-nums ${score != null && score < 0 ? 'text-red' : ''}`}>
        {score != null ? score : '–'}
      </span>
    </div>
  );
}

function RecordBracketForm({
  match,
  game,
  onSubmit,
  onCancel,
}: {
  match: TournamentMatch;
  game: Game;
  onSubmit: (scoreA: number, scoreB: number) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [winner, setWinner] = useState<'a' | 'b' | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [winnerGames, setWinnerGames] = useState(2); // smash : games du vainqueur (2 ou 3)
  const [busy, setBusy] = useState(false);

  const send = async (scoreA: number, scoreB: number) => {
    setBusy(true);
    try {
      await onSubmit(scoreA, scoreB);
    } finally {
      setBusy(false);
    }
  };

  // Étape 1 — vainqueur. Aux échecs, le résultat est binaire : un clic suffit.
  if (!winner) {
    const pick = (w: 'a' | 'b') => {
      if (game === 'chess') void send(w === 'a' ? 1 : 0, w === 'a' ? 0 : 1);
      else setWinner(w);
    };
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-muted text-center">{t('tournois.match.whoWon')}</div>
        <div className="grid grid-cols-2 gap-2">
          <OutcomeButton kind="win" onClick={() => pick('a')}>
            {match.playerALogin ?? t('tournois.match.playerA')}
          </OutcomeButton>
          <OutcomeButton kind="win" onClick={() => pick('b')}>
            {match.playerBLogin ?? t('tournois.match.playerB')}
          </OutcomeButton>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} className="w-full">{t('tournois.match.cancel')}</Button>
      </div>
    );
  }

  const loserLabel =
    winner === 'a' ? (match.playerBLogin ?? t('tournois.match.playerB')) : (match.playerALogin ?? t('tournois.match.playerA'));

  // Set (Smash / Street Fighter) : score du set en games (vainqueur 2 ou 3, perdant strictement moins).
  if (game === 'smash' || game === 'streetfighter') {
    const loserGames = Math.min(loserScore, winnerGames - 1);
    const chip = (active: boolean) =>
      `w-8 h-8 rounded-lg font-mono font-extrabold tabular-nums transition-all ${
        active ? 'bg-gold/15 text-gold ring-1 ring-gold/50' : 'bg-bg-2/50 text-muted-2'
      }`;
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-muted text-center">{t('tournois.match.setScore')}</div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-2">
          <span className="w-20 text-right">{t('tournois.match.winner')}</span>
          {[2, 3].map((g) => (
            <button key={g} type="button" onClick={() => setWinnerGames(g)} className={chip(winnerGames === g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-2">
          <span className="w-20 text-right truncate">{loserLabel}</span>
          {Array.from({ length: winnerGames }, (_, i) => i).map((g) => (
            <button key={g} type="button" onClick={() => setLoserScore(g)} className={chip(loserGames === g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setWinner(null)} className="flex-none">←</Button>
          <Button
            size="sm"
            loading={busy}
            onClick={() => send(winner === 'a' ? winnerGames : loserGames, winner === 'a' ? loserGames : winnerGames)}
            className="flex-1"
          >
            OK
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="flex-none">×</Button>
        </div>
      </div>
    );
  }

  // Babyfoot : abaque du score du perdant (le vainqueur marque 10).
  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs text-muted text-center">
        {t('tournois.match.loserScore')} <span className="text-text font-semibold">{loserLabel}</span>
      </div>
      <AbacusSlider
        value={loserScore}
        onChange={setLoserScore}
        min={LOSER_SCORE_MIN}
        max={LOSER_SCORE_MAX}
      />
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" variant="ghost" onClick={() => setWinner(null)} className="flex-none">←</Button>
        <Button
          size="sm"
          loading={busy}
          onClick={() => send(winner === 'a' ? WINNING_SCORE : loserScore, winner === 'a' ? loserScore : WINNING_SCORE)}
          className="flex-1"
        >
          OK
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="flex-none">×</Button>
      </div>
    </div>
  );
}
