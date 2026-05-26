import { useState, useRef, useEffect, useCallback, forwardRef, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
import { ContestModal } from '../components/ContestModal';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useI18n, useT } from '../lib/i18n';
import { fmtRelative, isoLocalNowPlusMinutes } from '../lib/format';

type Kind = 'incoming' | 'outgoing' | 'accepted';

export function DefisPage() {
  const t = useT();
  const { lang } = useI18n();
  const { challenges, leaderboard, me, pending, matches, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

  const myLogin = me?.login;
  const incoming = challenges.filter(
    (c) => c.opponentLogin === myLogin && c.status === 'pending',
  );
  const outgoing = challenges.filter(
    (c) => c.challengerLogin === myLogin && c.status === 'pending',
  );
  const accepted = challenges.filter((c) => c.status === 'accepted');

  const pendingToConfirm = pending.filter((p) => p.opponentLogin === myLogin);
  const pendingWaiting = pending.filter((p) => p.declarerLogin === myLogin);

  const others = leaderboard.filter((u) => u.login !== myLogin);

  // Extract recent opponents from match history, sorted by frequency (most played first)
  const opponentCounts: Record<string, number> = {};
  matches.forEach((m) => {
    if (m.playerALogin === myLogin) {
      opponentCounts[m.playerBLogin] = (opponentCounts[m.playerBLogin] || 0) + 1;
    } else if (m.playerBLogin === myLogin) {
      opponentCounts[m.playerALogin] = (opponentCounts[m.playerALogin] || 0) + 1;
    }
  });
  
  const recentOpponentLogins = Object.entries(opponentCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([login]) => login);

  const recentOpponents = recentOpponentLogins
    .map((login) => leaderboard.find((u) => u.login === login))
    .filter((u): u is LeaderboardEntry => u !== undefined);

  const handleAction = async (id: string, action: 'accept' | 'decline') => {
    if (action === 'decline') {
      const ch = challenges.find((c) => c.id === id);
      const iAmChallenger = ch?.challengerLogin === myLogin;
      const opp = ch
        ? iAmChallenger
          ? ch.opponentLogin
          : ch.challengerLogin
        : '';
      const wasAccepted = ch?.status === 'accepted';
      const ok = await confirm({
        title: wasAccepted
          ? 'Fuir ce match ?'
          : iAmChallenger
            ? 'Annuler ce défi ?'
            : 'Refuser ce défi ?',
        message: wasAccepted
          ? `Le match contre ${opp} était accepté par les deux. Si tu annules maintenant, c'est considéré comme une fuite.`
          : iAmChallenger
            ? `Annuler ton défi envoyé à ${opp} ?`
            : `Refuser le défi de ${opp} ?`,
        warning: wasAccepted ? '⚠ Pénalité : -10 ELO + 1 fuite marquée sur ton profil.' : undefined,
        confirmLabel: wasAccepted
          ? 'Confirmer la fuite'
          : iAmChallenger
            ? 'Annuler'
            : 'Refuser',
        cancelLabel: 'Garder',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      if (action === 'accept') {
        await api.acceptChallenge(id);
        flash.show('Défi accepté');
      } else {
        await api.declineChallenge(id);
        flash.show('Défi clos');
      }
      await refresh();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')}>
      {/* Quick retroactive game declaration */}
      <DeclareGameSection
        others={others}
        recentOpponents={recentOpponents}
        opponentCounts={opponentCounts}
        myLogin={myLogin}
        onDone={refresh}
      />

      {/* Pending confirmations */}
      {(pendingToConfirm.length > 0 || pendingWaiting.length > 0) && (
        <div className="space-y-4 mb-6">
          {pendingToConfirm.length > 0 && (
            <Section title="À confirmer">
              {pendingToConfirm.map((p) => (
                <PendingConfirmRow
                  key={p.id}
                  match={p}
                  onDone={refresh}
                />
              ))}
            </Section>
          )}
          {pendingWaiting.length > 0 && (
            <Section title="En attente de confirmation">
              {pendingWaiting.map((p) => (
                <PendingWaitRow key={p.id} match={p} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Active challenges */}
      {(incoming.length || outgoing.length || accepted.length) > 0 && (
        <div className="space-y-4 mb-6">
          {incoming.length > 0 && (
            <Section title={t('defis.received')}>
              {incoming.map((c) => (
                <ChallengeRow
                  key={c.id}
                  c={c}
                  kind="incoming"
                  myLogin={myLogin}
                  lang={lang}
                  onAccept={() => handleAction(c.id, 'accept')}
                  onDecline={() => handleAction(c.id, 'decline')}
                />
              ))}
            </Section>
          )}
          {accepted.length > 0 && (
            <Section title={t('defis.scheduled')}>
              {accepted.map((c) => (
                <ChallengeRow
                  key={c.id}
                  c={c}
                  kind="accepted"
                  myLogin={myLogin}
                  lang={lang}
                  onAccept={() => {}}
                  onDecline={() => handleAction(c.id, 'decline')}
                />
              ))}
            </Section>
          )}
          {outgoing.length > 0 && (
            <Section title={t('defis.sent')}>
              {outgoing.map((c) => (
                <ChallengeRow
                  key={c.id}
                  c={c}
                  kind="outgoing"
                  myLogin={myLogin}
                  lang={lang}
                  onAccept={() => {}}
                  onDecline={() => handleAction(c.id, 'decline')}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Challenge form */}
      <Section title={t('defis.challenge')}>
        {others.length === 0 ? (
          <div className="text-center text-muted-2 py-6">{t('defis.empty')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {others.map((u) => (
              <ChallengeCard
                key={u.login}
                login={u.login}
                imageUrl={u.imageUrl}
                elo={u.elo}
                rank={u.rank}
                onSent={() => refresh()}
              />
            ))}
          </div>
        )}
      </Section>
    </Panel>
  );
}

// ─── Declare retroactive game ────────────────────────────────────────────────

function DeclareGameSection({
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  onDone,
}: {
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const flash = useFlash();
  const [opponent, setOpponent] = useState<LeaderboardEntry | null>(null);
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setOpponent(null);
    setIWon(null);
    setLoserScore(0);
  };

  const handleOpponentSelect = (u: LeaderboardEntry) => {
    setOpponent(u);
  };

  const handleOutcome = (won: boolean) => {
    setIWon(won);
    setLoserScore(0);
  };

  const handleSubmit = async () => {
    if (!opponent || iWon === null) return;
    const scoreSelf = iWon ? 10 : loserScore;
    const scoreOpponent = iWon ? loserScore : 10;
    setBusy(true);
    try {
      await api.declareMatch({ opponentLogin: opponent.login, scoreSelf, scoreOpponent });
      flash.show(`Game déclarée — ${opponent.login} doit confirmer le score`);
      await onDone();
      reset();
      setOpen(false);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const winnerLogin = iWon ? (myLogin ?? 'Moi') : opponent?.login ?? '';
  const loserLogin = iWon ? opponent?.login ?? '' : (myLogin ?? 'Moi');

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full group flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-border hover:border-teal hover:bg-teal/5 transition-all duration-300 text-muted-2 hover:text-teal text-xs font-bold uppercase tracking-wider shadow-sm hover:shadow-md"
        >
          <span className="text-lg transition-transform duration-300 group-hover:rotate-90">+</span>
          Déclarer une game passée
        </button>
      ) : (
        <div
          className="relative border border-teal/30 rounded-2xl p-6 shadow-2xl bg-bg-0/80 backdrop-blur-md animate-pop min-h-[460px] flex flex-col"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,217,220,0.15), transparent 70%)',
          }}
        >
          <div className="relative flex items-center justify-between mb-6">
            <span className="text-xs font-extrabold uppercase tracking-widest text-teal">
              Déclarer une game passée
            </span>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="text-muted hover:text-text-strong transition-colors text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
            >
              ×
            </button>
          </div>

          {/* Step 1 — Opponent */}
          <div className="relative mb-6 z-20">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
              Adversaire
            </label>
            <PlayerSearch
              players={others}
              recentPlayers={recentOpponents}
              opponentCounts={opponentCounts}
              selected={opponent}
              onSelect={handleOpponentSelect}
              onClear={() => { setOpponent(null); setIWon(null); }}
            />
          </div>

          {/* Step 2 — Outcome */}
          {opponent && iWon === null && (
            <div key="outcome" className="relative mb-2 animate-slide-down flex-1">
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3">
                Résultat
              </label>
              <div className="grid grid-cols-2 gap-4">
                <OutcomeButton kind="win" onClick={() => handleOutcome(true)}>
                  J'ai gagné
                </OutcomeButton>
                <OutcomeButton kind="loss" onClick={() => handleOutcome(false)}>
                  J'ai perdu
                </OutcomeButton>
              </div>
            </div>
          )}

          {/* Step 2 recap chip */}
          {opponent && iWon !== null && (
            <div className="relative mb-6 animate-fade-in">
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                Résultat
              </label>
              <button
                onClick={() => setIWon(null)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm hover:shadow-md ${
                  iWon
                    ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20'
                    : 'border-red/40 bg-red/10 text-red hover:bg-red/20'
                }`}
              >
                <span className="text-sm font-extrabold tracking-wide">
                  {iWon ? "🏆 J'ai gagné" : "💀 J'ai perdu"}
                </span>
                <span className="text-muted-2 text-lg leading-none">×</span>
              </button>
            </div>
          )}

          {/* Step 3 — Abacus score + confirmation */}
          {opponent && iWon !== null && (
            <div key="score" className="relative animate-slide-down flex-1 flex flex-col justify-end">
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-4 text-center">
                Score de {iWon ? opponent.login : (myLogin ?? 'moi')}
              </label>

              <AbacusSlider value={loserScore} onChange={setLoserScore} min={-10} max={9} />

              {/* Confirmation line */}
              <div className="mt-8 px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
                <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
                {' a gagné '}
                <span className="font-extrabold text-text-strong text-base">10</span>
                <span className="text-muted mx-2 opacity-50">/</span>
                <span className={`font-extrabold text-base ${loserScore < 0 ? 'text-red' : 'text-text-strong'}`}>{loserScore}</span>
                {' face à '}
                <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
              </div>

              {/* Send button */}
              <div className="mt-5">
                <Button
                  size="md"
                  loading={busy}
                  onClick={handleSubmit}
                  className="w-full py-3 text-sm font-bold shadow-lg"
                >
                  Envoyer la déclaration
                </Button>
              </div>

              <p className="mt-4 text-[10px] text-muted/70 leading-relaxed text-center font-medium">
                {opponent.login} devra confirmer ce score pour valider la game.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Outcome win/loss button ──────────────────────────────────────────────────

function OutcomeButton({
  kind,
  onClick,
  children,
}: {
  kind: 'win' | 'loss';
  onClick: () => void;
  children: ReactNode;
}) {
  const isWin = kind === 'win';
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden py-6 rounded-xl border-2 transition-all duration-300 active:scale-[0.97] shadow-sm hover:shadow-xl ${
        isWin
          ? 'border-teal/30 bg-teal/5 hover:border-teal hover:bg-teal/10 hover:shadow-teal/20'
          : 'border-red/30 bg-red/5 hover:border-red hover:bg-red/10 hover:shadow-red/20'
      }`}
    >
      <div className="relative flex flex-col items-center gap-2">
        <span className={`text-3xl transition-transform duration-300 group-hover:scale-125 group-hover:-translate-y-1 ${isWin ? '' : 'grayscale opacity-80'}`}>
          {isWin ? '🏆' : '💀'}
        </span>
        <span className={`text-sm font-extrabold uppercase tracking-widest ${isWin ? 'text-teal' : 'text-red'}`}>
          {children}
        </span>
      </div>
    </button>
  );
}

// ─── Abacus slider ────────────────────────────────────────────────────────────
//
// Foosball-style score rod: one 3D bead threaded on a metallic rod with tick
// detents under it. The bead is rendered at the snapped integer position; CSS
// transition with spring easing produces the "magnetic" feel when the bead
// glides between detents as the user drags. During a drag the transition is
// shortened so the bead tracks the pointer in real time.

function AbacusSlider({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const valueFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const padding = 28; // matches px-7 below
    const usable = rect.width - padding * 2;
    const x = Math.max(0, Math.min(usable, clientX - rect.left - padding));
    const ratio = usable <= 0 ? 0 : x / usable;
    return Math.round(min + ratio * (max - min));
  }, [min, max, value]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const next = valueFromPointer(e.clientX);
    if (next !== value) onChange(next);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = valueFromPointer(e.clientX);
    if (next !== value) onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const ratio = (value - min) / (max - min);
  const isNeg = value < 0;
  const isZero = value === 0;

  // Bead palette
  const beadGradient = isNeg
    ? 'radial-gradient(circle at 32% 28%, #ffd5dd 0%, #ff7a91 28%, #ff3b5c 55%, #8a0a23 100%)'
    : isZero
      ? 'radial-gradient(circle at 32% 28%, #ffffff 0%, #d8e0eb 30%, #8d9aae 60%, #3a4459 100%)'
      : 'radial-gradient(circle at 32% 28%, #d6ffff 0%, #7af0f2 25%, #00d9dc 55%, #014a4c 100%)';

  const beadShadow = isNeg
    ? `0 0 ${dragging ? 30 : 18}px rgba(255,59,92,${dragging ? 0.65 : 0.45}), 0 8px 14px rgba(0,0,0,0.55), inset -3px -4px 7px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.35)`
    : isZero
      ? `0 0 ${dragging ? 20 : 12}px rgba(150,164,180,${dragging ? 0.4 : 0.25}), 0 8px 14px rgba(0,0,0,0.55), inset -3px -4px 7px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.45)`
      : `0 0 ${dragging ? 30 : 18}px rgba(0,217,220,${dragging ? 0.65 : 0.45}), 0 8px 14px rgba(0,0,0,0.55), inset -3px -4px 7px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.35)`;

  return (
    <div className="select-none">
      {/* Big readout */}
      <div className="flex items-end justify-center mb-4 h-14">
        <span
          key={value}
          className={`text-6xl font-black tracking-tighter leading-none animate-bead-pulse ${
            isNeg ? 'text-red' : isZero ? 'text-muted-2' : 'text-teal'
          }`}
          style={{
            textShadow: isNeg
              ? '0 0 24px rgba(255,59,92,0.35)'
              : isZero
                ? 'none'
                : '0 0 24px rgba(0,217,220,0.35)',
          }}
        >
          {value}
        </span>
      </div>

      {/* Rod + bead */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative h-16 px-7 touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        {/* Metallic rod */}
        <div
          className="absolute top-1/2 left-7 right-7 h-[6px] -translate-y-1/2 rounded-full"
          style={{
            background:
              'linear-gradient(to bottom, #0c1118 0%, #2a3548 18%, #6b7689 45%, #b0bccd 52%, #6b7689 60%, #1f2737 82%, #0a0e15 100%)',
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.6) inset, 0 8px 14px rgba(0,0,0,0.55), 0 0 22px rgba(0,217,220,0.08)',
          }}
        />

        {/* End caps for the rod */}
        <div
          className="absolute top-1/2 left-6 w-2 h-3 -translate-y-1/2 rounded-sm"
          style={{
            background: 'linear-gradient(to bottom, #243044, #0c1118 60%, #1a2233)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        />
        <div
          className="absolute top-1/2 right-6 w-2 h-3 -translate-y-1/2 rounded-sm"
          style={{
            background: 'linear-gradient(to bottom, #243044, #0c1118 60%, #1a2233)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        />

        {/* Tick detents (every integer position) */}
        {ticks.map((t) => {
          const tr = (t - min) / (max - min);
          const isMajor = t === min || t === max || t === 0;
          const isNear = Math.abs(t - value) <= 1;
          return (
            <div
              key={t}
              onClick={(e) => { e.stopPropagation(); onChange(t); }}
              className="absolute top-1/2 -translate-x-1/2 cursor-pointer"
              style={{ left: `calc(28px + ${tr} * (100% - 56px))`, transform: 'translate(-50%, -50%)' }}
              aria-label={`Score ${t}`}
            >
              <div
                className={`mx-auto rounded-full transition-all duration-200 ${
                  isMajor
                    ? 'w-[3px] h-5 bg-muted-2/70'
                    : isNear
                      ? 'w-[2px] h-3.5 bg-muted/80'
                      : 'w-[2px] h-2.5 bg-muted/40'
                }`}
              />
            </div>
          );
        })}

        {/* Bead (3D sphere threaded on the rod) */}
        <div
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: `calc(28px + ${ratio} * (100% - 56px))`,
            transform: 'translate(-50%, -50%)',
            transition: dragging
              ? 'left 90ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Outer halo while dragging */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ${dragging ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`}
            style={{
              background: isNeg
                ? 'radial-gradient(circle, rgba(255,59,92,0.25) 0%, transparent 70%)'
                : isZero
                  ? 'radial-gradient(circle, rgba(150,164,180,0.2) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(0,217,220,0.25) 0%, transparent 70%)',
            }}
          />
          {/* Bead body */}
          <div
            className={`relative w-11 h-11 rounded-full transition-transform duration-150 ${dragging ? 'scale-[1.08]' : 'scale-100'}`}
            style={{ background: beadGradient, boxShadow: beadShadow }}
          >
            {/* Specular highlight */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                top: 5,
                left: 7,
                width: 12,
                height: 8,
                background: 'radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)',
                filter: 'blur(0.5px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-[10px] text-muted mt-2 px-5 font-mono font-bold opacity-70 tracking-wider">
        <span>{min}</span>
        <span className={isZero ? 'text-muted-2' : ''}>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── PlayerSearch combobox ────────────────────────────────────────────────────

function PlayerSearch({
  players,
  recentPlayers,
  opponentCounts,
  selected,
  onSelect,
  onClear,
}: {
  players: LeaderboardEntry[];
  recentPlayers: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  selected: LeaderboardEntry | null;
  onSelect: (p: LeaderboardEntry) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Default view (no query): recent opponents first (sorted by play count desc),
  // then everyone else by leaderboard rank. Fully scrollable.
  // With a query: filter the full pool of players by login.
  const defaultList: LeaderboardEntry[] = (() => {
    const recentLogins = new Set(recentPlayers.map((p) => p.login));
    const others = players.filter((p) => !recentLogins.has(p.login));
    return [...recentPlayers, ...others];
  })();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter((p) => p.login.toLowerCase().includes(q))
    : defaultList;

  const commit = useCallback((p: LeaderboardEntry) => {
    onSelect(p);
    setQuery('');
    setOpen(false);
    setActiveIdx(0);
  }, [onSelect]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: { key: string; preventDefault(): void }) => {
    if (!open) { if (e.key !== 'Escape') setOpen(true); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) commit(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // If a player is selected, show chip
  if (selected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-1 border-2 border-teal/40 rounded-xl animate-pop shadow-sm">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border-2 border-teal/50 shadow-sm">
          {selected.imageUrl ? (
            <img src={selected.imageUrl} alt={selected.login} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-teal-deep flex items-center justify-center text-xs font-bold text-[#001416]">
              {selected.login[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <span className="font-extrabold text-base text-text-strong flex-1">{selected.login}</span>
        <span className="text-teal text-sm font-bold bg-teal/10 px-2 py-1 rounded-md">{selected.elo} ELO</span>
        <button
          onClick={() => { onClear(); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="ml-2 text-muted hover:text-red transition-colors text-xl leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-red/10"
          title="Changer d'adversaire"
        >
          ×
        </button>
      </div>
    );
  }

  const showingRecents = !q && recentPlayers.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-base pointer-events-none">🔍</span>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tape un pseudo…"
          className="w-full pl-11 pr-4 py-3.5 bg-bg-1 border-2 border-border rounded-xl text-sm font-medium focus:border-teal outline-none text-text-strong placeholder:text-muted transition-all shadow-sm focus:shadow-md"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-bg-1 border border-border rounded-xl shadow-2xl overflow-hidden animate-pop">
          {showingRecents && (
            <div className="flex items-center justify-between px-4 py-2 bg-bg-2/50 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                Tes adversaires
              </span>
              <span className="text-[10px] text-muted-2 font-mono">
                {recentPlayers.length} joué·s · scrolle pour voir tous
              </span>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {filtered.map((p, i) => {
              const count = opponentCounts[p.login] ?? 0;
              const isPlayed = count > 0;
              return (
                <button
                  key={p.login}
                  onMouseDown={(e) => { e.preventDefault(); commit(p); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIdx
                      ? 'bg-teal/10 text-text-strong border-l-2 border-teal'
                      : 'hover:bg-bg-2 text-muted-2 border-l-2 border-transparent'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-border shadow-sm">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.login} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-teal-deep flex items-center justify-center text-xs font-bold text-[#001416]">
                        {p.login[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      <HighlightMatch text={p.login} query={query} />
                    </div>
                    <div className="text-[10px] text-muted font-medium">
                      {isPlayed ? (
                        <span className="text-teal/80">
                          {count} game{count > 1 ? 's' : ''} jouée{count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span>Jamais joué</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-xs text-teal font-extrabold leading-none">{p.elo}</span>
                    <span className="text-[9px] text-muted font-medium leading-none">#{p.rank}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && q.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-bg-1 border border-border rounded-xl shadow-2xl px-4 py-4 text-sm text-muted font-medium text-center animate-pop">
          Aucun joueur trouvé
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-teal">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Score input ──────────────────────────────────────────────────────────────

interface ScoreInputProps {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder: string;
  highlight?: boolean;
  id?: string;
}

const ScoreInput = forwardRef<HTMLInputElement, ScoreInputProps>(function ScoreInput(
  { value, onChange, onEnter, placeholder, highlight, id },
  ref,
) {
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted truncate max-w-full px-1">{placeholder}</span>
      <input
        ref={ref}
        id={id}
        type="number"
        min={-10}
        max={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        className={`w-full text-center text-2xl font-bold py-2 px-1 bg-bg-0 border rounded outline-none transition-colors
          ${highlight
            ? 'border-teal/60 focus:border-teal text-teal'
            : 'border-border focus:border-teal/60 text-text-strong'
          }`}
        placeholder="–"
      />
    </div>
  );
});

// ─── Pending match rows ───────────────────────────────────────────────────────

function PendingConfirmRow({
  match,
  onDone,
}: {
  match: PendingMatch;
  onDone: () => Promise<void>;
}) {
  const flash = useFlash();
  const [confirming, setConfirming] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [myScore, setMyScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [busy, setBusy] = useState(false);

  const declarer = match.declarerLogin;
  const theirDeclaredScore = match.scoreDeclarer;
  const myDeclaredScore = match.scoreOpponent;

  const handleConfirm = async () => {
    const a = Number(myScore);
    const b = Number(oppScore);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    setBusy(true);
    try {
      await api.confirmMatch(match.id, a, b);
      flash.show('✓ Match confirmé — ELO mis à jour !');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleContestSubmit = async (
    reason: 'never_played' | 'wrong_score',
    message: string,
  ) => {
    setBusy(true);
    try {
      await api.rejectMatch(match.id, reason, message);
      flash.show('Contestation envoyée.');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
      setContesting(false);
    }
  };

  return (
    <>
      <div className="p-3 border border-gold/30 bg-gold/5 rounded-lg animate-pop">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-base">⚡</span>
          <PlayerLink login={declarer} className="font-semibold text-gold">
            {declarer}
          </PlayerLink>
          <span className="text-muted-2">a déclaré :</span>
          <span className="font-bold tabular-nums text-text-strong text-base">
            {theirDeclaredScore}
            <span className="text-muted mx-1.5">–</span>
            {myDeclaredScore}
          </span>
          <span className="text-[10px] text-muted bg-bg-2 px-1.5 py-0.5 rounded">(eux – toi)</span>
        </div>

        {/* Actions ou formulaire de confirmation */}
        {!confirming ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => setConfirming(true)} className="flex-1">
              ✓ Confirmer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setContesting(true)}
              className="text-red border-red/30 hover:border-red hover:bg-red/5 hover:text-red"
            >
              Contester
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-muted leading-relaxed">
              Entre le score tel que tu l'as vécu. Il doit correspondre exactement à la déclaration de {declarer} pour valider.
            </p>
            <div className="flex items-center gap-3">
              <ScoreInput value={myScore} onChange={setMyScore} placeholder="Toi" highlight />
              <span className="text-muted font-bold text-lg flex-shrink-0">–</span>
              <ScoreInput value={oppScore} onChange={setOppScore} placeholder={declarer} />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                loading={busy}
                disabled={myScore === '' || oppScore === ''}
                onClick={handleConfirm}
                className="flex-1"
              >
                Valider
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Retour
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Contest modal */}
      {contesting && (
        <ContestModal
          declarerLogin={declarer}
          score={`${theirDeclaredScore}–${myDeclaredScore}`}
          busy={busy}
          onSubmit={handleContestSubmit}
          onClose={() => setContesting(false)}
        />
      )}
    </>
  );
}


function PendingWaitRow({ match }: { match: PendingMatch }) {
  const opp = match.opponentLogin;
  return (
    <div className="p-3 border border-border bg-bg-2/40 rounded flex flex-wrap items-center gap-2 text-sm">
      <span className="text-base opacity-50">⏳</span>
      <span className="text-muted-2">En attente de</span>
      <PlayerLink login={opp} className="font-semibold">
        {opp}
      </PlayerLink>
      <span className="font-bold tabular-nums text-text-strong">
        {match.scoreDeclarer}
        <span className="text-muted mx-1">–</span>
        {match.scoreOpponent}
      </span>
      <span className="text-[10px] text-muted">(toi – eux)</span>
      <span className="ml-auto text-[10px] text-muted italic">confirmation en attente…</span>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ChallengeRowProps {
  c: Challenge;
  kind: Kind;
  myLogin: string | undefined;
  lang: 'fr' | 'en';
  onAccept: () => void;
  onDecline: () => void;
}

function ChallengeRow({ c, kind, myLogin, lang, onAccept, onDecline }: ChallengeRowProps) {
  const opp = c.challengerLogin === myLogin ? c.opponentLogin : c.challengerLogin;
  const r = fmtRelative(c.scheduledAt, lang);
  const [recording, setRecording] = useState(false);

  return (
    <div className="p-3 border border-border bg-bg-2/40 rounded">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base">⚔</span>
        <span className="text-muted-2">
          {kind === 'incoming' ? 'Défi de' : kind === 'outgoing' ? 'Défi à' : 'Match vs'}
        </span>
        <PlayerLink login={opp} className="font-semibold">
          {opp}
        </PlayerLink>
        <span className={`text-xs ${r.late ? 'text-red' : 'text-muted-2'}`}>{r.text}</span>
        <div className="flex-1" />
        {kind === 'incoming' && (
          <>
            <Button size="sm" onClick={onAccept}>
              Accepter
            </Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>
              Refuser
            </Button>
          </>
        )}
        {kind === 'outgoing' && (
          <Button size="sm" variant="ghost" onClick={onDecline}>
            Annuler
          </Button>
        )}
        {kind === 'accepted' && !recording && (
          <>
            <Button size="sm" onClick={() => setRecording(true)}>
              Saisir score
            </Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>
              Annuler
            </Button>
          </>
        )}
      </div>
      {kind === 'accepted' && recording && (
        <RecordResultForm
          challengeId={c.id}
          oppLogin={opp}
          onDone={() => setRecording(false)}
        />
      )}
    </div>
  );
}

function RecordResultForm({
  challengeId,
  oppLogin,
  onDone,
}: {
  challengeId: string;
  oppLogin: string;
  onDone: () => void;
}) {
  const { refresh } = useLeagueData();
  const flash = useFlash();
  const [me, setMe] = useState('');
  const [opp, setOpp] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
      <input
        type="number"
        min={0}
        max={10}
        placeholder="Ton score"
        value={me}
        onChange={(e) => setMe(e.target.value)}
        className="px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
      />
      <input
        type="number"
        min={0}
        max={10}
        placeholder={`Score ${oppLogin}`}
        value={opp}
        onChange={(e) => setOpp(e.target.value)}
        className="px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
      />
      <Button
        size="sm"
        loading={busy}
        onClick={async () => {
          const a = Number(me);
          const b = Number(opp);
          if (!Number.isFinite(a) || !Number.isFinite(b)) return;
          setBusy(true);
          try {
            await api.recordChallengeResult(challengeId, a, b);
            flash.show('Score envoyé — en attente de confirmation');
            await refresh();
            onDone();
          } catch (err) {
            flash.show(err instanceof Error ? err.message : String(err), 'error');
          } finally {
            setBusy(false);
          }
        }}
      >
        Envoyer
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Annuler
      </Button>
    </div>
  );
}

interface ChallengeCardProps {
  login: string;
  imageUrl: string | null;
  elo: number;
  rank: number;
  onSent: () => Promise<void>;
}

function ChallengeCard({ login, imageUrl, elo, rank, onSent }: ChallengeCardProps) {
  const [open, setOpen] = useState(false);
  const flash = useFlash();
  const [when, setWhen] = useState(() => isoLocalNowPlusMinutes(30));
  const [busy, setBusy] = useState(false);

  return (
    <div className="p-3 border border-border bg-bg-2/40 rounded">
      <div className="flex items-center gap-2.5">
        <PlayerLink login={login} className="flex-1 min-w-0">
          <Avatar login={login} imageUrl={imageUrl} size="md" />
          <div className="min-w-0">
            <div className="font-bold truncate text-text-strong">{login}</div>
            <div className="text-[11px] text-muted-2">
              <span className="text-teal font-bold">{elo}</span> ELO · #{rank}
            </div>
          </div>
        </PlayerLink>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          Défier
        </Button>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none"
          />
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              if (!when) return;
              const iso = new Date(when).toISOString();
              setBusy(true);
              try {
                await api.createChallenge({ opponentLogin: login, scheduledAt: iso });
                flash.show(`Défi envoyé à @${login}`);
                await onSent();
                setOpen(false);
              } catch (err) {
                flash.show(err instanceof Error ? err.message : String(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Envoyer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
