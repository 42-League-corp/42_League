import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
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

export function TournoiDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ?? '';
  const { me } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

  const [tn, setTn] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTn(await api.tournament(id));
    } catch {
      setTn(null);
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
  if (!tn) {
    return (
      <Panel title="Tournoi" sub="introuvable">
        <BackLink />
        <div className="text-center text-muted-2 py-10">Tournoi introuvable.</div>
      </Panel>
    );
  }

  const myLogin = me?.login;
  const isOrganizer = tn.createdByLogin === myLogin;
  const iAmIn = !!tn.entries?.some((e) => e.login === myLogin);
  const count = tn.entries?.length ?? 0;
  const kindLabel = tn.kind === 'official' ? '★ OFFICIEL' : 'AMICAL';
  const sub = `${kindLabel} · ${count}/${tn.capacity} · ${STATUS_LABEL[tn.status]}`;

  const doAction = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      flash.show(ok);
      await load();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Panel title={tn.name} sub={sub}>
      <BackLink />

      {tn.status === 'registration' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {!iAmIn && count < tn.capacity && (
              <Button onClick={() => doAction(() => api.joinTournament(tn.id), 'Inscrit au tournoi')}>
                S'inscrire
              </Button>
            )}
            {iAmIn && (
              <Button
                variant="ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Quitter ce tournoi ?',
                    message: 'Tu te retires des inscriptions.',
                    confirmLabel: 'Quitter',
                    cancelLabel: 'Rester',
                    danger: true,
                  });
                  if (!ok) return;
                  await doAction(() => api.leaveTournament(tn.id), 'Désinscrit');
                }}
              >
                Se retirer
              </Button>
            )}
            {isOrganizer && count === tn.capacity && (
              <Button
                onClick={() => doAction(() => api.startTournament(tn.id), 'Tournoi lancé · bracket généré')}
              >
                Lancer le tournoi
              </Button>
            )}
            {isOrganizer && (
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Annuler ce tournoi ?',
                    message: 'Tous les participants seront retirés.',
                    confirmLabel: 'Annuler le tournoi',
                    cancelLabel: 'Garder',
                    danger: true,
                  });
                  if (!ok) return;
                  await doAction(() => api.cancelTournament(tn.id), 'Tournoi annulé');
                }}
              >
                Annuler
              </Button>
            )}
          </div>

          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
            Inscrits
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(tn.entries ?? []).map((e) => (
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
            {Array.from({ length: tn.capacity - count }).map((_, i) => (
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

      {tn.status !== 'registration' && (
        <>
          {tn.winner && tn.status === 'finished' && (
            <div className="border border-gold/40 bg-gold/5 rounded p-5 mb-6 text-center">
              <div className="text-gold text-xs uppercase tracking-[0.18em] font-extrabold mb-3">
                🏆 VAINQUEUR
              </div>
              <PlayerLink login={tn.winner.login} className="inline-flex flex-col gap-2 text-base">
                <Avatar login={tn.winner.login} imageUrl={tn.winner.imageUrl ?? null} size="lg" />
                <span className="font-extrabold text-text-strong">{tn.winner.login}</span>
              </PlayerLink>
            </div>
          )}

          <Bracket tn={tn} myLogin={myLogin ?? null} onChange={load} />
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
  tn,
  myLogin,
  onChange,
}: {
  tn: Tournament;
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  const matches = tn.matches ?? [];
  const totalRounds = Math.log2(tn.capacity);
  const rounds = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const arr = rounds.get(m.round) ?? [];
    arr.push(m);
    rounds.set(m.round, arr);
  }

  return (
    <div className="flex gap-4 overflow-x-auto -mx-4 px-4 pb-2">
      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => {
        const label =
          r === totalRounds
            ? 'FINALE'
            : r === totalRounds - 1
              ? 'DEMI-FINALES'
              : r === totalRounds - 2
                ? 'QUARTS'
                : `TOUR ${r}`;
        const ms = (rounds.get(r) ?? []).sort((a, b) => a.slot - b.slot);
        return (
          <div key={r} className="min-w-[240px] flex flex-col gap-3 justify-around">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold text-center">
              {label}
            </div>
            <div className="flex flex-col gap-3">
              {ms.map((m) => (
                <BracketMatch
                  key={m.id}
                  tn={tn}
                  m={m}
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
  tn,
  m,
  myLogin,
  onChange,
}: {
  tn: Tournament;
  m: TournamentMatch;
  myLogin: string | null;
  onChange: () => Promise<void>;
}) {
  const winnerA = m.winnerLogin && m.winnerLogin === m.playerALogin;
  const winnerB = m.winnerLogin && m.winnerLogin === m.playerBLogin;
  const iAmIn = !!(myLogin && (m.playerALogin === myLogin || m.playerBLogin === myLogin));
  const recorded = m.recordedByLogin != null && m.scoreA != null && m.scoreB != null;
  const iRecorded = recorded && m.recordedByLogin === myLogin;
  const [recording, setRecording] = useState(false);
  const flash = useFlash();
  const confirm = useConfirm();

  return (
    <div
      className={
        'p-2.5 border rounded bg-bg-2/50 ' + (m.confirmedAt ? 'border-teal/40' : 'border-border')
      }
    >
      <PlayerRow login={m.playerALogin} score={m.scoreA} winner={!!winnerA} />
      <PlayerRow login={m.playerBLogin} score={m.scoreB} winner={!!winnerB} />

      {tn.status === 'in_progress' &&
        iAmIn &&
        m.playerALogin &&
        m.playerBLogin &&
        !m.confirmedAt && (
          <>
            {!recorded && !recording && (
              <Button size="sm" full className="mt-2" onClick={() => setRecording(true)}>
                Saisir le score
              </Button>
            )}
            {recording && (
              <RecordBracketForm
                m={m}
                onSubmit={async (a, b) => {
                  try {
                    await api.recordTournamentMatch(tn.id, m.id, a, b);
                    flash.show('Score enregistré · en attente de confirmation');
                    setRecording(false);
                    await onChange();
                  } catch (err) {
                    flash.show(
                      err instanceof Error ? err.message : String(err),
                      'error',
                    );
                  }
                }}
                onCancel={() => setRecording(false)}
              />
            )}
            {recorded && iRecorded && (
              <div className="text-[11px] text-muted-2 mt-2 text-center">
                En attente de confirmation par l'adversaire ({m.scoreA}-{m.scoreB})
              </div>
            )}
            {recorded && !iRecorded && (
              <div className="mt-2">
                <div className="text-[11px] text-gold mb-1.5">
                  Score à confirmer : {m.scoreA}-{m.scoreB}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const res = await api.confirmTournamentMatch(
                          tn.id,
                          m.id,
                          m.scoreA!,
                          m.scoreB!,
                        );
                        flash.show(
                          res.finished
                            ? `🏆 ${res.winnerLogin} remporte le tournoi !`
                            : 'Score confirmé',
                        );
                        await onChange();
                      } catch (err) {
                        flash.show(
                          err instanceof Error ? err.message : String(err),
                          'error',
                        );
                      }
                    }}
                  >
                    Confirmer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Refuser ce score ?',
                        message: 'Le score sera reset, à ressaisir.',
                        confirmLabel: 'Refuser',
                        cancelLabel: 'Garder',
                        danger: true,
                      });
                      if (!ok) return;
                      try {
                        await api.rejectTournamentMatch(tn.id, m.id);
                        flash.show('Score reset');
                        await onChange();
                      } catch (err) {
                        flash.show(
                          err instanceof Error ? err.message : String(err),
                          'error',
                        );
                      }
                    }}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            )}
          </>
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
      className={
        'flex items-center justify-between gap-2 py-1.5 px-1 border-b border-border/40 last:border-0 ' +
        (winner ? 'text-text-strong font-bold' : 'text-text')
      }
    >
      {login ? (
        <PlayerLink login={login} className="text-sm truncate min-w-0">
          <Avatar login={login} imageUrl={null} size="xs" />
          <span className="truncate">{login}</span>
        </PlayerLink>
      ) : (
        <span className="text-sm text-muted">?</span>
      )}
      <span className="text-sm tabular-nums">{score != null ? score : '–'}</span>
    </div>
  );
}

function RecordBracketForm({
  m,
  onSubmit,
  onCancel,
}: {
  m: TournamentMatch;
  onSubmit: (a: number, b: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5 mt-2">
      <input
        type="number"
        min={0}
        max={10}
        placeholder={m.playerALogin ?? ''}
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="px-2 py-1 bg-bg-0 border border-border rounded text-xs focus:border-teal outline-none"
      />
      <input
        type="number"
        min={0}
        max={10}
        placeholder={m.playerBLogin ?? ''}
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="px-2 py-1 bg-bg-0 border border-border rounded text-xs focus:border-teal outline-none"
      />
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          const sa = Number(a);
          const sb = Number(b);
          if (!Number.isFinite(sa) || !Number.isFinite(sb)) return;
          setBusy(true);
          try {
            await onSubmit(sa, sb);
          } finally {
            setBusy(false);
          }
        }}
      >
        OK
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        ×
      </Button>
    </div>
  );
}
