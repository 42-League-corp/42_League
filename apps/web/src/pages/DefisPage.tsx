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
  const { challenges, leaderboard, me, pending, refresh } = useLeagueData();
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
  myLogin,
  onDone,
}: {
  others: LeaderboardEntry[];
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
          className="relative border border-teal/30 rounded-2xl p-6 shadow-2xl bg-bg-0/80 backdrop-blur-md animate-pop min-h-[420px] flex flex-col"
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

// ─── Abacus slider (Foosball Style) ───────────────────────────────────────────

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
  const beads = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const valueFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const padding = 24; // matches px-6 below
    const usable = rect.width - padding * 2;
    const x = Math.max(0, Math.min(usable, clientX - rect.left - padding));
    const ratio = usable <= 0 ? 0 : x / usable;
    return Math.round(min + ratio * (max - min));
  }, [min, max, value]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
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
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  return (
    <div className="select-none">
      {/* Big readout */}
      <div className="flex items-end justify-center gap-2 mb-6 h-16">
        <span
          key={value}
          className={`text-6xl font-black tracking-tighter leading-none animate-bead-pulse drop-shadow-md ${
            value < 0 ? 'text-red' : value === 0 ? 'text-muted-2' : 'text-teal'
          }`}
        >
          {value}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-16 px-6 cursor-pointer touch-none group"
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        {/* Metal rod (Babyfoot style) */}
        <div className="absolute top-1/2 left-4 right-4 h-3 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#555] via-[#888] to-[#444] shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)] border border-[#333]" />

        {/* center marker (0) */}
        <div
          className="absolute top-1/2 w-1 h-6 -translate-y-1/2 bg-black/40 rounded-full pointer-events-none"
          style={{ left: `calc(24px + ${(0 - min) / (max - min)} * (100% - 48px))` }}
        />

        {/* beads */}
        {beads.map((b) => {
          const ratio = (b - min) / (max - min);
          const active = b === value;
          const isZero = b === 0;
          
          return (
            <div
              key={b}
              onClick={(e) => { e.stopPropagation(); onChange(b); }}
              className={`absolute top-1/2 transition-all duration-200 ease-out cursor-pointer flex items-center justify-center ${
                active ? 'z-20' : 'z-10 hover:scale-110'
              }`}
              style={{
                left: `calc(24px + ${ratio} * (100% - 48px))`,
                width: active ? 28 : 14,
                height: active ? 44 : 24,
                transform: 'translate(-50%, -50%)',
              }}
              aria-label={`Score ${b}`}
            >
              {/* 3D Foosball Counter */}
              <div className={`w-full h-full rounded-[4px] shadow-[0_4px_6px_rgba(0,0,0,0.4)] border-b-[3px] border-t border-t-white/20 transition-colors duration-200 ${
                active
                  ? b < 0
                    ? 'bg-gradient-to-b from-[#ff5a75] to-[#d92645] border-b-[#8a1226]'
                    : 'bg-gradient-to-b from-[#00f0f5] to-[#00b3b8] border-b-[#006b6e]'
                  : isZero
                    ? 'bg-gradient-to-b from-[#666] to-[#444] border-b-[#222] opacity-60'
                    : 'bg-gradient-to-b from-[#444] to-[#222] border-b-[#111] opacity-40'
              }`} />
            </div>
          );
        })}
      </div>

      {/* Axis labels */}
      <div className="flex justify-between text-[11px] text-muted mt-3 px-2 font-mono font-bold opacity-60">
        <span>{min}</span>
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── PlayerSearch combobox ────────────────────────────────────────────────────

function PlayerSearch({
  players,
  selected,
  onSelect,
  onClear,
}: {
  players: LeaderboardEntry[];
  selected: LeaderboardEntry | null;
  onSelect: (p: LeaderboardEntry) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? players.filter((p) => p.login.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : players.slice(0, 6);

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
          {filtered.map((p, i) => (
            <button
              key={p.login}
              onMouseDown={(e) => { e.preventDefault(); commit(p); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                i === activeIdx ? 'bg-teal/10 text-text-strong border-l-4 border-teal' : 'hover:bg-bg-2 text-muted-2 border-l-4 border-transparent'
              }`}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-border shadow-sm">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.login} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-teal-deep flex items-center justify-center text-xs font-bold text-[#001416]">
                    {p.login[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <span className="flex-1 text-sm font-bold">
                <HighlightMatch text={p.login} query={query} />
              </span>
              <span className="text-xs text-teal font-extrabold">{p.elo}</span>
              <span className="text-[10px] text-muted font-medium">#{p.rank}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length > 0 && filtered.length === 0 && (
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
