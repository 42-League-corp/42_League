import { useState, useRef, useEffect, useCallback, forwardRef, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { PlayerLink } from '../components/PlayerLink';
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
                  myLogin={myLogin ?? ''}
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
  const [myScore, setMyScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [busy, setBusy] = useState(false);
  const myScoreRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setOpponent(null);
    setMyScore('');
    setOppScore('');
  };

  const handleOpponentSelect = (u: LeaderboardEntry) => {
    setOpponent(u);
    // Auto-focus first score field after selection
    setTimeout(() => myScoreRef.current?.focus(), 50);
  };

  const handleSubmit = async () => {
    if (!opponent || myScore === '' || oppScore === '') return;
    const a = Number(myScore);
    const b = Number(oppScore);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    setBusy(true);
    try {
      await api.declareMatch({ opponentLogin: opponent.login, scoreSelf: a, scoreOpponent: b });
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

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full group flex items-center justify-center gap-2 py-3 rounded border border-dashed border-border hover:border-teal hover:bg-teal/5 transition-all duration-200 text-muted-2 hover:text-teal text-xs font-bold uppercase tracking-wider"
        >
          <span className="text-base transition-transform duration-200 group-hover:rotate-90">+</span>
          Déclarer une game passée
        </button>
      ) : (
        <div className="border border-teal/40 bg-teal/5 rounded-lg p-4 animate-pop">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal">
              Déclarer une game passée
            </span>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="text-muted hover:text-text-strong transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
            >
              ×
            </button>
          </div>

          {/* Opponent search */}
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Adversaire
            </label>
            <PlayerSearch
              players={others}
              selected={opponent}
              onSelect={handleOpponentSelect}
              onClear={() => setOpponent(null)}
            />
          </div>

          {/* Score inputs */}
          <div className={`transition-all duration-200 ${opponent ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-semibold mb-1.5">
              Score (toi – adversaire)
            </label>
            <div className="flex items-center gap-3">
              <ScoreInput
                ref={myScoreRef}
                value={myScore}
                onChange={setMyScore}
                onEnter={() => document.getElementById('opp-score-input')?.focus()}
                placeholder={myLogin ?? 'Toi'}
                highlight
              />
              <span className="text-muted font-bold text-lg flex-shrink-0">–</span>
              <ScoreInput
                id="opp-score-input"
                value={oppScore}
                onChange={setOppScore}
                onEnter={handleSubmit}
                placeholder={opponent?.login ?? 'Adversaire'}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              loading={busy}
              disabled={!opponent || myScore === '' || oppScore === ''}
              onClick={handleSubmit}
              className="flex-1"
            >
              Déclarer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setOpen(false); reset(); }}
            >
              Annuler
            </Button>
          </div>

          <p className="mt-3 text-[10px] text-muted leading-relaxed">
            L'adversaire devra entrer le même score pour valider la game.
          </p>
        </div>
      )}
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
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-0 border border-teal/50 rounded animate-pop">
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-teal/40">
          {selected.imageUrl ? (
            <img src={selected.imageUrl} alt={selected.login} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-teal-deep flex items-center justify-center text-[10px] font-bold text-[#001416]">
              {selected.login[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <span className="font-bold text-sm text-text-strong flex-1">{selected.login}</span>
        <span className="text-teal text-xs font-bold">{selected.elo} ELO</span>
        <button
          onClick={() => { onClear(); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="ml-1 text-muted hover:text-red transition-colors text-base leading-none"
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">🔍</span>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tape un pseudo…"
          className="w-full pl-9 pr-3 py-2.5 bg-bg-0 border border-border rounded text-sm focus:border-teal outline-none text-text-strong placeholder:text-muted transition-colors"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-bg-1 border border-border rounded-lg shadow-xl overflow-hidden animate-pop">
          {filtered.map((p, i) => (
            <button
              key={p.login}
              onMouseDown={(e) => { e.preventDefault(); commit(p); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                i === activeIdx ? 'bg-teal/10 text-text-strong' : 'hover:bg-bg-2 text-muted-2'
              }`}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-border">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.login} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-teal-deep flex items-center justify-center text-[10px] font-bold text-[#001416]">
                    {p.login[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <span className="flex-1 text-sm font-semibold">
                <HighlightMatch text={p.login} query={query} />
              </span>
              <span className="text-xs text-teal font-bold">{p.elo}</span>
              <span className="text-[10px] text-muted">#{p.rank}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-bg-1 border border-border rounded-lg shadow-xl px-4 py-3 text-sm text-muted text-center animate-pop">
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
        min={0}
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
  myLogin,
  onDone,
}: {
  match: PendingMatch;
  myLogin: string;
  onDone: () => Promise<void>;
}) {
  const flash = useFlash();
  const [confirming, setConfirming] = useState(false);
  const [myScore, setMyScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [busy, setBusy] = useState(false);

  const declarer = match.declarerLogin;
  // From my perspective: match.scoreOpponent = my score, match.scoreDeclarer = their score
  const theirDeclaredScore = match.scoreDeclarer;
  const myDeclaredScore = match.scoreOpponent;

  const handleConfirm = async () => {
    const a = Number(myScore);
    const b = Number(oppScore);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return;
    setBusy(true);
    try {
      await api.confirmMatch(match.id, a, b);
      flash.show('Match confirmé ! ELO mis à jour.');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await api.rejectMatch(match.id);
      flash.show('Match refusé.');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 border border-gold/30 bg-gold/5 rounded animate-pop">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-base">⚡</span>
        <span className="text-muted-2">
          <PlayerLink login={declarer} className="font-semibold text-gold">
            {declarer}
          </PlayerLink>
          <span className="ml-1.5">a déclaré :</span>
        </span>
        <span className="font-bold tabular-nums text-text-strong">
          {theirDeclaredScore}
          <span className="text-muted mx-1">–</span>
          {myDeclaredScore}
        </span>
        <span className="text-[10px] text-muted">(eux – toi)</span>
        <div className="flex-1" />
        {!confirming && (
          <>
            <Button size="sm" onClick={() => setConfirming(true)}>
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReject} disabled={busy}>
              Refuser
            </Button>
          </>
        )}
      </div>

      {confirming && (
        <div className="mt-3 space-y-3">
          <p className="text-[10px] text-muted">
            Entre le score tel que tu l'as vécu — doit correspondre à ce que {declarer} a déclaré.
          </p>
          <div className="flex items-end gap-3">
            <ScoreInput
              value={myScore}
              onChange={setMyScore}
              placeholder="Toi"
              highlight
            />
            <span className="text-muted font-bold text-lg mb-2.5">–</span>
            <ScoreInput
              value={oppScore}
              onChange={setOppScore}
              placeholder={declarer}
            />
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
            <Button size="sm" variant="ghost" onClick={handleReject} disabled={busy}>
              Refuser
            </Button>
          </div>
        </div>
      )}
    </div>
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
