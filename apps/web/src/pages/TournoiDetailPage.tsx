import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
import { AbacusSlider } from '../components/AbacusSlider';
import { OutcomeButton } from '../components/OutcomeButton';
import { api, type Tournament, type TournamentMatch } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';

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
  const { me } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

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
  const iAmIn = !!tournament.entries?.some((e) => e.login === myLogin);
  const entriesCount = tournament.entries?.length ?? 0;
  const kindLabel = tournament.kind === 'official' ? '★ OFFICIEL' : 'AMICAL';
  const sub = `${kindLabel} · ${entriesCount}/${tournament.capacity} · ${STATUS_LABEL[tournament.status]}`;

  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    try {
      await action();
      flash.show(successMsg);
      await load();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

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
      message: 'Tous les participants seront retirés.',
      confirmLabel: 'Annuler le tournoi',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
    await runAction(() => api.cancelTournament(tournament.id), 'Tournoi annulé');
  };

  return (
    <Panel title={tournament.name} sub={sub}>
      <BackLink />

      {tournament.status === 'registration' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {!iAmIn && entriesCount < tournament.capacity && (
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
            {isOrganizer && (
              <Button variant="danger" onClick={handleCancel}>Annuler</Button>
            )}
          </div>

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

          <Bracket tournament={tournament} myLogin={myLogin ?? null} onChange={load} />
        </>
      )}
    </Panel>
  );
}

function BackLink() {
  return (
    <Link
      to="/tournois"
      className="inline-block text-[11px] uppercase tracking-wider text-muted-2 hover:text-teal mb-3"
    >
      ← Retour aux tournois
    </Link>
  );
}

function Bracket({
  tournament,
  myLogin,
  onChange,
}: {
  tournament: Tournament;
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  // Pré-calcule les rounds une fois — recompute uniquement si la liste des matchs change.
  // Math.log2 est valide tant que capacity est une puissance de 2 (garanti par CreateTournamentSchema).
  const { totalRounds, roundsByIndex } = useMemo(() => {
    const total = Math.log2(tournament.capacity);
    const byIndex = new Map<number, TournamentMatch[]>();
    for (const m of tournament.matches ?? []) {
      const arr = byIndex.get(m.round) ?? [];
      arr.push(m);
      byIndex.set(m.round, arr);
    }
    for (const arr of byIndex.values()) {
      arr.sort((a, b) => a.slot - b.slot);
    }
    return { totalRounds: total, roundsByIndex: byIndex };
  }, [tournament.capacity, tournament.matches]);

  return (
    <div className="flex gap-4 overflow-x-auto -mx-4 px-4 pb-2">
      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
        const matches = roundsByIndex.get(round) ?? [];
        return (
          <div key={round} className="min-w-[240px] flex flex-col gap-3 justify-around">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold text-center">
              {roundLabel(round, totalRounds)}
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
        <Button size="sm" full className="mt-2" onClick={() => setRecording(true)}>
          Saisir le score
        </Button>
      )}

      {canRecord && recording && (
        <RecordBracketForm
          match={match}
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
  onSubmit,
  onCancel,
}: {
  match: TournamentMatch;
  onSubmit: (scoreA: number, scoreB: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [winner, setWinner] = useState<'a' | 'b' | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!winner) return;
    setBusy(true);
    try {
      const scoreA = winner === 'a' ? WINNING_SCORE : loserScore;
      const scoreB = winner === 'b' ? WINNING_SCORE : loserScore;
      await onSubmit(scoreA, scoreB);
    } finally {
      setBusy(false);
    }
  };

  if (!winner) {
    return (
      <div className="mt-2 space-y-2">
        <div className="text-xs text-muted text-center">Qui a gagné ?</div>
        <div className="grid grid-cols-2 gap-2">
          <OutcomeButton kind="win" onClick={() => setWinner('a')}>
            {match.playerALogin ?? 'Joueur A'}
          </OutcomeButton>
          <OutcomeButton kind="win" onClick={() => setWinner('b')}>
            {match.playerBLogin ?? 'Joueur B'}
          </OutcomeButton>
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} className="w-full">Annuler</Button>
      </div>
    );
  }

  const loserLabel =
    winner === 'a' ? (match.playerBLogin ?? 'Joueur B') : (match.playerALogin ?? 'Joueur A');

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
        <Button size="sm" loading={busy} onClick={submit} className="flex-1">OK</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="flex-none">×</Button>
      </div>
    </div>
  );
}
