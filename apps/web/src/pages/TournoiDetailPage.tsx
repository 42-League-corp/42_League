import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
import { AbacusSlider } from '../components/AbacusSlider';
import { OutcomeButton } from '../components/OutcomeButton';
import { api, type Game, type Tournament, type TournamentMatch, type TournamentInvite, type LeaderboardEntry } from '../lib/api';
import { PlayerSearch } from './defis/shared/PlayerSearch';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useServerEvents } from '../hooks/useServerEvents';

const STATUS_LABEL: Record<Tournament['status'], string> = {
  registration: 'INSCRIPTIONS',
  in_progress: 'EN COURS',
  finished: 'TERMINÉ',
  cancelled: 'ANNULÉ',
};

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = WINNING_SCORE - 1;

function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'FINALE';
  if (fromEnd === 1) return 'DEMI-FINALES';
  if (fromEnd === 2) return 'QUARTS';
  return `TOUR ${round}`;
}

export function TournoiDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ?? '';
  const { me, leaderboard, locations } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitee, setInvitee] = useState<LeaderboardEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTournament(await api.tournament(id));
    } catch {
      setTournament(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Rafraîchit la page en temps réel quand une mise à jour de tournoi ou une
  // invitation est reçue (accept, decline, nouveau joueur, démarrage…).
  useServerEvents(load, ['tournament:update', 'tournament:invite', 'tournament:invite_declined']);

  if (loading) {
    return (
      <Panel title="Tournoi" sub="…">
        <BackLink />
        <div className="text-center text-muted-2 py-10">Chargement…</div>
      </Panel>
    );
  }
  if (!tournament) {
    return (
      <Panel title="Tournoi" sub="introuvable">
        <BackLink />
        <div className="text-center text-muted-2 py-10">Tournoi introuvable.</div>
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
      await load();
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
      `Invitation envoyée à ${login}`,
    );
  };

  const handleAcceptInvite = async (invite: TournamentInvite) => {
    await runAction(
      () => api.acceptTournamentInvite(tournament.id, invite.id),
      'Tu as rejoint le tournoi',
    );
  };

  const handleDeclineInvite = async (invite: TournamentInvite) => {
    await runAction(
      () => api.declineTournamentInvite(tournament.id, invite.id),
      'Invitation déclinée',
    );
  };

  const kindLabel = tournament.kind === 'official' ? '★ OFFICIEL' : 'AMICAL';
  const visLabel = tournament.isPrivate ? ' · 🔒 PRIVÉ' : '';
  const formatLabel = tournament.format === 'pools' ? ' · POULES' : '';
  const sub = `${kindLabel}${visLabel}${formatLabel} · ${entriesCount}/${tournament.capacity} · ${STATUS_LABEL[tournament.status]}`;

  const handleLeave = async () => {
    const ok = await confirm({
      title: 'Quitter ce tournoi ?',
      message: 'Tu te retires des inscriptions.',
      confirmLabel: 'Quitter',
      cancelLabel: 'Rester',
      danger: true,
    });
    if (!ok) return;
    await runAction(() => api.leaveTournament(tournament.id), 'Désinscrit');
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Annuler ce tournoi ?',
      message: 'Le tournoi sera supprimé définitivement et disparaîtra de la liste.',
      warning: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer le tournoi',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.cancelTournament(tournament.id);
      flash.show('Tournoi supprimé');
      navigate('/tournaments');
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Panel title={tournament.name} sub={sub}>
      <BackLink />

      {tournament.status === 'registration' && (
        <>
          {tournament.isPrivate && !iAmIn && !isOrganizer && !isAdmin && (
            <div className="mb-4 text-[11px] text-teal flex items-center gap-1.5 uppercase tracking-wider font-semibold">
              🔒 Tournoi privé — accès sur invitation de l'organisateur.
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-4">
            {!iAmIn && entriesCount < tournament.capacity &&
              (!tournament.isPrivate || isOrganizer || isAdmin) && (
              <Button onClick={() => runAction(() => api.joinTournament(tournament.id), 'Inscrit au tournoi')}>
                S'inscrire
              </Button>
            )}
            {iAmIn && (
              <Button variant="ghost" onClick={handleLeave}>Se retirer</Button>
            )}
            {isOrganizer && entriesCount === tournament.capacity && (
              <Button onClick={() => runAction(() => api.startTournament(tournament.id), 'Tournoi lancé · bracket généré')}>
                Lancer le tournoi
              </Button>
            )}
            {(isOrganizer || isAdmin) && (
              <Button variant="danger" onClick={handleCancel}>Supprimer</Button>
            )}
          </div>

          {/* Bannière : invitation reçue en attente de décision */}
          {myPendingInvite && !iAmIn && (
            <div className="mb-4 p-4 rounded-xl border border-gold/40 bg-gold/[0.06]">
              <div className="text-sm font-extrabold text-gold mb-1">
                Tu as été invité à ce tournoi
              </div>
              <div className="text-xs text-muted-2 mb-3">
                Par <span className="font-semibold text-text-strong">{myPendingInvite.inviterLogin}</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleAcceptInvite(myPendingInvite)} className="flex-1">
                  Rejoindre
                </Button>
                <Button variant="ghost" onClick={() => handleDeclineInvite(myPendingInvite)} className="flex-1 text-red border-red/30">
                  Décliner
                </Button>
              </div>
            </div>
          )}

          {/* Section invitation (organisateur / admin) */}
          {(isOrganizer || isAdmin) && entriesCount < tournament.capacity && (
            <div className="mb-4 p-3 rounded-xl border border-gold/20 bg-bg-2/30">
              <div className="text-[10px] uppercase tracking-wider text-gold font-extrabold mb-2">
                Inviter un joueur
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
                    {invitee ? `Envoyer l'invitation à ${invitee.login}` : 'Envoyer une invitation'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-2">Tous les joueurs disponibles ont déjà été invités.</p>
              )}
              <p className="text-[10px] text-muted mt-1.5">
                Le joueur recevra une notification et devra accepter pour rejoindre.
              </p>

              {/* Invitations en attente (vue organisateur) */}
              {(tournament.invites ?? []).filter((i) => i.status === 'pending').length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                    En attente de réponse
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
            Inscrits
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
                <div className="text-muted text-sm font-semibold">Place libre</div>
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
                🏆 VAINQUEUR
              </div>
              <PlayerLink login={tournament.winner.login} className="inline-flex flex-col gap-2 text-base">
                <Avatar login={tournament.winner.login} imageUrl={tournament.winner.imageUrl ?? null} size="lg" />
                <span className="font-extrabold text-text-strong">{tournament.winner.login}</span>
              </PlayerLink>
            </div>
          )}

          <PoolsAndBracket tournament={tournament} myLogin={myLogin ?? null} onChange={load} />

          {tournament.status === 'in_progress' && (isOrganizer || isAdmin) && (
            <div className="mt-6 pt-4 border-t border-border/40 flex justify-end">
              <Button size="sm" variant="danger" onClick={handleCancel}>
                Supprimer le tournoi
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function BackLink() {
  return (
    <Link
      to="/tournaments"
      className="inline-block text-[11px] uppercase tracking-wider text-muted-2 hover:text-teal mb-3"
    >
      ← Retour aux tournois
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
  const { poolGroups, bracketRounds, totalBracketRounds, poolsComplete } = useMemo(() => {
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
    const byRound = new Map<number, TournamentMatch[]>();
    for (const m of bracketMatches) {
      const arr = byRound.get(m.round) ?? [];
      arr.push(m);
      byRound.set(m.round, arr);
    }
    for (const arr of byRound.values()) arr.sort((a, b) => a.slot - b.slot);

    return {
      poolGroups: groups,
      bracketRounds: byRound,
      totalBracketRounds: total,
      poolsComplete: complete,
    };
  }, [tournament.matches]);

  const hasPools = poolGroups.length > 0;
  const hasBracket = totalBracketRounds > 0;

  return (
    <div className="space-y-6">
      {hasPools && (
        <section>
          <div className="text-[10px] uppercase tracking-[0.16em] text-gold font-extrabold mb-3 flex items-center gap-2">
            <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
            Phase de poules
            <span className="text-muted-2 normal-case font-mono">
              · top {QUALIFY_PER_POOL} qualifiés / poule
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
              Le bracket des qualifiés est généré automatiquement une fois tous les matchs de
              poule confirmés.
            </p>
          )}
        </section>
      )}

      {hasBracket ? (
        <section>
          {hasPools && (
            <div className="text-[10px] uppercase tracking-[0.16em] text-teal font-extrabold mb-3 flex items-center gap-2">
              <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-teal to-teal rounded-sm" />
              Phase finale
            </div>
          )}
          <div className="flex gap-4 overflow-x-auto -mx-4 px-4 pb-2">
            {Array.from({ length: totalBracketRounds }, (_, i) => i + 1).map((round) => {
              const matches = bracketRounds.get(round) ?? [];
              return (
                <div key={round} className="min-w-[240px] flex flex-col gap-3 justify-around">
                  <div className="text-[10px] uppercase tracking-wider text-muted font-semibold text-center">
                    {roundLabel(round, totalBracketRounds)}
                  </div>
                  <div className="flex flex-col gap-3">
                    {matches.map((m) => (
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
            })}
          </div>
        </section>
      ) : (
        !hasPools && (
          <div className="text-center text-muted-2 py-8 text-sm">Bracket en préparation…</div>
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
  const poolName = String.fromCharCode(65 + pool.index); // A, B, C…
  return (
    <div className="rounded-xl border border-border bg-bg-2/30 overflow-hidden">
      <div className="px-3 py-2 bg-bg-2/60 border-b border-border/50 text-[11px] font-extrabold uppercase tracking-wider text-text-strong">
        Poule {poolName}
      </div>
      {/* Classement */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-2 border-b border-border/40">
            <th className="text-left font-semibold py-1.5 pl-3">#</th>
            <th className="text-left font-semibold py-1.5">Joueur</th>
            <th className="text-center font-semibold py-1.5">J</th>
            <th className="text-center font-semibold py-1.5">V</th>
            <th className="text-center font-semibold py-1.5 pr-3">+/−</th>
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
  const [recording, setRecording] = useState(false);

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

  const handleRecordSubmit = async (scoreA: number, scoreB: number) => {
    try {
      await api.recordTournamentMatch(tournament.id, match.id, scoreA, scoreB);
      flash.show('Score enregistré · en attente de confirmation');
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
          ? `🏆 ${res.winnerLogin} remporte le tournoi !`
          : 'Score confirmé',
      );
      await onChange();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const handleReject = async () => {
    const ok = await confirm({
      title: 'Refuser ce score ?',
      message: 'Le score sera reset, à ressaisir.',
      confirmLabel: 'Refuser',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.rejectTournamentMatch(tournament.id, match.id);
      flash.show('Score reset');
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

      {canRecord && !recorded && !recording && (
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
            Saisir le score
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
          En attente de confirmation par l'adversaire ({match.scoreA}-{match.scoreB})
        </div>
      )}

      {canRecord && recorded && !iRecorded && (
        <div className="mt-2">
          <div className="text-[11px] text-gold mb-1.5">
            Score à confirmer : {match.scoreA}-{match.scoreB}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleConfirm}>Confirmer</Button>
            <Button size="sm" variant="ghost" onClick={handleReject}>Refuser</Button>
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
        <div className="text-xs text-muted text-center">Qui a gagné ?</div>
        <div className="grid grid-cols-2 gap-2">
          <OutcomeButton kind="win" onClick={() => pick('a')}>
            {match.playerALogin ?? 'Joueur A'}
          </OutcomeButton>
          <OutcomeButton kind="win" onClick={() => pick('b')}>
            {match.playerBLogin ?? 'Joueur B'}
          </OutcomeButton>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} className="w-full">Annuler</Button>
      </div>
    );
  }

  const loserLabel =
    winner === 'a' ? (match.playerBLogin ?? 'Joueur B') : (match.playerALogin ?? 'Joueur A');

  // Set (Smash / Street Fighter) : score du set en games (vainqueur 2 ou 3, perdant strictement moins).
  if (game === 'smash' || game === 'streetfighter') {
    const loserGames = Math.min(loserScore, winnerGames - 1);
    const chip = (active: boolean) =>
      `w-8 h-8 rounded-lg font-mono font-extrabold tabular-nums transition-all ${
        active ? 'bg-gold/15 text-gold ring-1 ring-gold/50' : 'bg-bg-2/50 text-muted-2'
      }`;
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-muted text-center">Score du set (games)</div>
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-2">
          <span className="w-20 text-right">Vainqueur</span>
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
        Score de <span className="text-text font-semibold">{loserLabel}</span>
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
