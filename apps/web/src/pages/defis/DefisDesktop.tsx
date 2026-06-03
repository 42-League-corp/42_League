import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Swords, X, ChevronDown, Clock, Zap } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { PlayerLink } from '../../components/PlayerLink';
import { OutcomeButton } from '../../components/OutcomeButton';
import { AbacusSlider } from '../../components/AbacusSlider';
import { ContestModal } from '../../components/ContestModal';
import {
  api,
  type Challenge,
  type Game,
  type LeaderboardEntry,
  type MatchResultInput,
  type PendingMatch,
} from '../../lib/api';
import { useMemo } from 'react';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { pickRating } from '../../lib/gameStats';
import { RankedBadge } from '../../components/RankedBadge';
import { StatCard } from '../../components/StatCard';
import { useFlash } from '../../hooks/useFlash';
import { useI18n, useT, type Lang } from '../../lib/i18n';
import { fmtRelative } from '../../lib/format';
import { useDefisLogic } from './shared/useDefisLogic';
import {
  DeclareGameFlow,
  WINNING_SCORE,
  LOSER_SCORE_MIN,
  LOSER_SCORE_MAX,
} from './shared/DeclareGameFlow';
import { ChallengeFlow } from './shared/ChallengeFlow';

// ─── Types ────────────────────────────────────────────────────────────────────
type Kind = 'incoming' | 'outgoing' | 'accepted';
type OpenCard = 'declare' | 'challenge' | null;
const NOOP = () => {};

// ─── Badges de discipline ─────────────────────────────────────────────────────
const GAME_BADGE: Partial<Record<Game, string>> = {
  smash: '🎮 Smash',
  chess: '♟ Échecs',
  streetfighter: '🥊 Street Fighter',
};

function GameTag({ game }: { game?: Game }) {
  if (!game || game === 'babyfoot') return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-[0.12em] bg-accent/12 text-accent border border-accent/25">
      {GAME_BADGE[game]}
    </span>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function DefisDesktop() {
  const t = useT();
  const { lang } = useI18n();
  const { locations, me, matches, leaderboard } = useLeagueData();
  const { game } = useGameMode();
  const {
    myLogin,
    incoming,
    outgoing,
    accepted,
    pendingToConfirm,
    pendingWaiting,
    others,
    recentOpponents,
    opponentCounts,
    refresh,
    handleAction,
    cancelDeclaration,
  } = useDefisLogic();

  const [openCard, setOpenCard] = useState<OpenCard>(null);
  const [presetOpp, setPresetOpp] = useState<LeaderboardEntry | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Stats game-aware : filtrées sur la discipline courante (corrige le bug ELO global).
  const gameStats = useMemo(() => {
    const login = myLogin;
    if (!me?.user || !login) return null;
    const mine = (matches ?? []).filter(
      (m) => (m.game ?? 'babyfoot') === game &&
        (m.playerALogin === login || m.playerBLogin === login),
    );
    let wins = 0; let losses = 0; let streak = 0; let streakBroken = false;
    for (const m of [...mine].sort((a, b) => +new Date(b.playedAt) - +new Date(a.playedAt))) {
      const isA = m.playerALogin === login;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      if (won) wins++; else losses++;
      if (!streakBroken) { if (won) streak++; else streakBroken = true; }
    }
    const total = wins + losses;
    const rank = leaderboard.find((u) => u.login === login)?.rank ?? null;
    const rating = pickRating(me.user, game);
    return { elo: rating.elo, rank, wins, losses, winRate: total ? Math.round(wins / total * 100) : 0, streak };
  }, [me, myLogin, matches, leaderboard, game]);

  const openChallengeWith = (player: LeaderboardEntry | null) => {
    setPresetOpp(player);
    setOpenCard('challenge');
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasActivity =
    pendingToConfirm.length > 0 ||
    pendingWaiting.length > 0 ||
    incoming.length > 0 ||
    accepted.length > 0 ||
    outgoing.length > 0;

  return (
    <Panel title={t('panel.defis.title')} sub={t('panel.defis.sub')} accent="swords">
      <div ref={topRef} />

      {/* ── Stats game-aware (mini bar, toujours visible) ────────────────── */}
      {gameStats && (
        <div className="grid grid-cols-5 gap-2 mb-6">
          <StatCard value={gameStats.rank ? `#${gameStats.rank}` : '—'} label="Rang" tone="gold" />
          <StatCard value={String(gameStats.elo)} label={<>ELO <RankedBadge size="xs" /></>} tone="teal" />
          <StatCard value={`${gameStats.wins}-${gameStats.losses}`} label="V-D" tone="neutral" />
          <StatCard value={`${gameStats.winRate}%`} label="Win rate" tone={gameStats.winRate >= 50 ? 'win' : 'loss'} />
          <StatCard
            value={gameStats.streak > 0 ? `${gameStats.streak}V` : gameStats.streak < 0 ? `${Math.abs(gameStats.streak)}D` : '—'}
            label="Série"
            tone={gameStats.streak > 0 ? 'win' : gameStats.streak < 0 ? 'loss' : 'neutral'}
          />
        </div>
      )}

      {/* ── 1. HERO CTAs ─────────────────────────────────────────────────── */}
      {/* Les 2 boutons les plus importants du site : toujours au-dessus du pli,
          taille héro, jamais discrets. */}
      <HeroCTAs
        openCard={openCard}
        presetOpp={presetOpp}
        others={others}
        recentOpponents={recentOpponents}
        opponentCounts={opponentCounts}
        myLogin={myLogin}
        locations={locations}
        onOpen={(c) => {
          if (c === 'challenge') setPresetOpp(null);
          setOpenCard(c);
        }}
        onClose={() => { setOpenCard(null); setPresetOpp(null); }}
        onDone={refresh}
      />

      {/* ── 2. ACTIVITÉ (flux compact, en dessous des CTAs) ──────────────── */}
      {hasActivity && (
        <ActivityStream
          pendingToConfirm={pendingToConfirm}
          pendingWaiting={pendingWaiting}
          incoming={incoming}
          accepted={accepted}
          outgoing={outgoing}
          myLogin={myLogin}
          lang={lang}
          refresh={refresh}
          handleAction={handleAction}
          cancelDeclaration={cancelDeclaration}
        />
      )}

      {/* ── 3. POOL COMPLET DE JOUEURS ───────────────────────────────────── */}
      <PlayerPool
        players={others}
        leaderboard={[]}
        game={game}
        onChallenge={openChallengeWith}
        onDeclare={(p) => { setPresetOpp(p); setOpenCard('declare'); }}
      />
    </Panel>
  );
}

// ─── Hero CTAs ────────────────────────────────────────────────────────────────
// Les 2 boutons d'action principaux du site : Déclarer + Défier.
// Fermés : grandes cartes hero avec glow et animation d'entrée.
// Ouverts : expansion pleine largeur avec le flow de saisie intégré.

interface HeroCTAsProps {
  openCard: OpenCard;
  presetOpp: LeaderboardEntry | null;
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  locations: Map<string, string>;
  onOpen: (card: Exclude<OpenCard, null>) => void;
  onClose: () => void;
  onDone: () => Promise<void>;
}

function HeroCTAs({
  openCard, presetOpp, others, recentOpponents, opponentCounts,
  myLogin, locations, onOpen, onClose, onDone,
}: HeroCTAsProps) {
  const submitAndClose = async () => { await onDone(); onClose(); };

  return (
    <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <AnimatePresence mode="popLayout">
        {(openCard === null || openCard === 'declare') && (
          <HeroCTACard
            key="declare"
            kind="declare"
            expanded={openCard === 'declare'}
            onOpen={() => onOpen('declare')}
            onClose={onClose}
          >
            <DeclareGameFlow
              variant="desktop"
              others={others}
              recentOpponents={recentOpponents}
              opponentCounts={opponentCounts}
              myLogin={myLogin}
              locations={locations}
              onSubmitted={submitAndClose}
            />
          </HeroCTACard>
        )}

        {(openCard === null || openCard === 'challenge') && (
          <HeroCTACard
            key="challenge"
            kind="challenge"
            expanded={openCard === 'challenge'}
            onOpen={() => onOpen('challenge')}
            onClose={onClose}
          >
            <ChallengeFlow
              key={presetOpp?.login ?? 'free'}
              variant="desktop"
              others={others}
              recentOpponents={recentOpponents}
              opponentCounts={opponentCounts}
              myLogin={myLogin}
              locations={locations}
              presetOpponent={presetOpp}
              onSubmitted={submitAndClose}
            />
          </HeroCTACard>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const CTA_META = {
  declare: {
    Icon: Plus,
    label: 'Déclarer une game',
    sub: 'Enregistrer une partie déjà jouée',
    gradient: 'from-gold/25 via-gold/8 to-transparent',
    border: 'border-gold/50 hover:border-gold',
    glow: '0 0 36px rgba(255,201,74,0.22)',
    iconBg: 'bg-gold/20',
    accent: 'text-gold',
  },
  challenge: {
    Icon: Swords,
    label: 'Défier un joueur',
    sub: 'Programmer un duel à venir',
    gradient: 'from-accent/20 via-accent/6 to-transparent',
    border: 'border-accent/50 hover:border-accent',
    glow: '0 0 36px rgba(var(--accent-gold),0.20)',
    iconBg: 'bg-accent/20',
    accent: 'text-accent',
  },
} as const;

interface HeroCTACardProps {
  kind: keyof typeof CTA_META;
  expanded: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

function HeroCTACard({ kind, expanded, onOpen, onClose, children }: HeroCTACardProps) {
  const meta = CTA_META[kind];
  const Icon = meta.Icon;

  if (!expanded) {
    return (
      <motion.button
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={onOpen}
        className={`shine group relative overflow-hidden rounded-2xl border-2 ${meta.border}
          bg-gradient-to-br from-bg-2/80 to-bg-1/90
          flex items-center gap-5 px-7 py-6
          transition-all duration-300 text-left
          active:scale-[0.98]`}
        style={{ boxShadow: meta.glow }}
      >
        {/* Gradient d'accent en background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-60 pointer-events-none`} />
        {/* Filet doré en haut */}
        <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent pointer-events-none" />

        {/* Icône grande et ronde */}
        <span
          className={`relative flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-2xl ${meta.iconBg}
            group-hover:scale-110 transition-transform duration-300`}
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,247,228,0.18)' }}
        >
          <Icon className={`w-8 h-8 ${meta.accent}`} strokeWidth={2.2} />
        </span>

        {/* Texte */}
        <span className="relative min-w-0 flex-1">
          <span className={`block font-display text-xl font-black tracking-tight ${meta.accent} leading-none mb-1.5`}>
            {meta.label}
          </span>
          <span className="block text-[11px] text-muted-2 font-medium uppercase tracking-[0.16em]">
            {meta.sub}
          </span>
        </span>

        {/* Flèche */}
        <span className={`relative ${meta.accent} opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all`}>
          →
        </span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="relative md:col-span-2 card-hud border-gold/40 rounded-2xl p-6 min-h-[460px] flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,201,74,0.18), transparent 70%)',
        boxShadow:
          '0 18px 48px rgba(0,0,0,0.5), 0 0 36px rgba(255,201,74,0.15), inset 0 1px 0 rgba(255,215,120,0.1)',
      }}
    >
      <div className="relative flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${meta.accent}`} strokeWidth={2.5} />
          <span className={`font-display text-base font-black ${meta.accent}`}>
            {meta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted hover:text-text-strong transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
      <div className="relative w-full max-w-md mx-auto flex-1">{children}</div>
    </motion.div>
  );
}

// ─── Flux d'activité (compact) ───────────────────────────────────────────────
// Regroupé dans une section dépliable pour ne pas écraser les CTAs.

interface ActivityStreamProps {
  pendingToConfirm: PendingMatch[];
  pendingWaiting: PendingMatch[];
  incoming: Challenge[];
  accepted: Challenge[];
  outgoing: Challenge[];
  myLogin: string | undefined;
  lang: Lang;
  refresh: () => Promise<void>;
  handleAction: (id: string, action: 'accept' | 'decline') => Promise<void>;
  cancelDeclaration: (match: PendingMatch) => void;
}

function ActivityStream({
  pendingToConfirm, pendingWaiting, incoming, accepted, outgoing,
  myLogin, lang, refresh, handleAction, cancelDeclaration,
}: ActivityStreamProps) {
  const urgentCount = pendingToConfirm.length + incoming.length;
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-8 rounded-2xl overflow-hidden border border-border/40 bg-white/[0.015]">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        {urgentCount > 0 && (
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold text-[#1a1100] text-[10px] font-extrabold flex items-center justify-center">
            {urgentCount}
          </span>
        )}
        <span className="font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold text-gold/90 flex-1 text-left">
          Activité en cours
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {pendingToConfirm.length > 0 && (
            <ActivityGroup label="À confirmer" badge={pendingToConfirm.length} urgent>
              {pendingToConfirm.map((p) => (
                <PendingConfirmRow key={p.id} match={p} onDone={refresh} />
              ))}
            </ActivityGroup>
          )}
          {incoming.length > 0 && (
            <ActivityGroup label="Défis reçus" badge={incoming.length} urgent>
              {incoming.map((c) => (
                <ChallengeRow key={c.id} challenge={c} kind="incoming" myLogin={myLogin} lang={lang}
                  onAccept={() => handleAction(c.id, 'accept')}
                  onDecline={() => handleAction(c.id, 'decline')} />
              ))}
            </ActivityGroup>
          )}
          {accepted.length > 0 && (
            <ActivityGroup label="Duels programmés" badge={accepted.length}>
              {accepted.map((c) => (
                <ChallengeRow key={c.id} challenge={c} kind="accepted" myLogin={myLogin} lang={lang}
                  onAccept={NOOP}
                  onDecline={() => handleAction(c.id, 'decline')} />
              ))}
            </ActivityGroup>
          )}
          {outgoing.length > 0 && (
            <ActivityGroup label="Défis envoyés" badge={outgoing.length}>
              {outgoing.map((c) => (
                <ChallengeRow key={c.id} challenge={c} kind="outgoing" myLogin={myLogin} lang={lang}
                  onAccept={NOOP}
                  onDecline={() => handleAction(c.id, 'decline')} />
              ))}
            </ActivityGroup>
          )}
          {pendingWaiting.length > 0 && (
            <ActivityGroup label="En attente de confirmation" badge={pendingWaiting.length}>
              {pendingWaiting.map((p) => (
                <PendingWaitRow key={p.id} match={p} onCancel={() => cancelDeclaration(p)} />
              ))}
            </ActivityGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityGroup({ label, badge, urgent = false, children }: {
  label: string; badge: number; urgent?: boolean; children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-gaming text-[9px] uppercase tracking-[0.16em] font-extrabold text-muted-2">{label}</span>
        <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-full ${urgent ? 'text-gold bg-gold/15' : 'text-muted bg-bg-2'}`}>
          {badge}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ─── Pool complet de joueurs ──────────────────────────────────────────────────
// Tous les joueurs, triés par rang, avec ELO + WR + boutons d'action.

interface PlayerPoolProps {
  players: LeaderboardEntry[];
  leaderboard: LeaderboardEntry[];
  game: Game;
  onChallenge: (player: LeaderboardEntry) => void;
  onDeclare: (player: LeaderboardEntry) => void;
}

function PlayerPool({ players, leaderboard: _lb, game: _game, onChallenge, onDeclare }: PlayerPoolProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? players.filter((p) => p.login.toLowerCase().includes(query.trim().toLowerCase()))
    : players;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold flex items-center gap-2">
          <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
          Pool de joueurs
          <span className="font-mono text-muted-2 normal-case tracking-normal">
            · {players.length} joueurs
          </span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent" />
        {/* Mini recherche */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer…"
          className="w-36 px-3 py-1.5 bg-bg-1 border border-border rounded-lg text-xs font-medium focus:border-gold outline-none text-text-strong placeholder:text-muted tap-transparent allow-select transition-all"
        />
      </div>

      {players.length === 0 ? (
        <div className="text-center text-muted-2 py-8 text-sm">{t('defis.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {filtered.map((u) => (
            <PlayerCard
              key={u.login}
              player={u}
              onChallenge={onChallenge}
              onDeclare={onDeclare}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  player,
  onChallenge,
  onDeclare,
}: {
  player: LeaderboardEntry;
  onChallenge: (p: LeaderboardEntry) => void;
  onDeclare: (p: LeaderboardEntry) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="card-hud rounded-xl p-3 hover-glow flex items-center gap-3 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Rang */}
      <span className="w-8 flex-shrink-0 text-center font-mono font-extrabold tabular-nums text-sm text-muted-2">
        #{player.rank}
      </span>

      {/* Avatar + infos */}
      <PlayerLink login={player.login} className="flex-1 min-w-0">
        <Avatar login={player.login} imageUrl={player.imageUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate text-text-strong text-sm">{player.login}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-gold font-extrabold font-mono tabular-nums text-[11px]">{player.elo}</span>
            <span className="text-[10px] text-muted-2">ELO</span>
          </div>
        </div>
      </PlayerLink>

      {/* Boutons d'action (visibles au hover) */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 flex-shrink-0"
          >
            <button
              type="button"
              onClick={() => onDeclare(player)}
              title="Déclarer une game passée"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-2 hover:text-gold hover:bg-gold/10 transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => onChallenge(player)}
              title="Défier ce joueur"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-2 hover:text-accent hover:bg-accent/10 transition-colors"
            >
              <Swords className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Ligne de match en attente de confirmation ────────────────────────────────

function PendingConfirmRow({ match, onDone }: { match: PendingMatch; onDone: () => Promise<void> }) {
  const flash = useFlash();
  const [contesting, setContesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(false);
  const iWon = match.scoreOpponent > match.scoreDeclarer;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await api.confirmMatch(match.id, match.scoreOpponent, match.scoreDeclarer, {
        game: match.game,
        bestOf: match.bestOf as 3 | 5 | undefined,
      });
      flash.show('✓ Match confirmé — ELO mis à jour !');
      setResolved(true);
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  const handleContestSubmit = async (reason: 'never_played' | 'wrong_score', message: string) => {
    setContesting(false);
    setBusy(true);
    try {
      await api.rejectMatch(match.id, reason, message);
      flash.show('Contestation envoyée.');
      setResolved(true);
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  if (resolved) return null;

  return (
    <>
      <div className="relative rounded-xl p-3 border border-gold/40 bg-gold/[0.05] animate-pop flex flex-wrap items-center gap-2.5">
        <Zap className="w-4 h-4 text-gold flex-shrink-0" strokeWidth={2.5} fill="rgba(255,201,74,0.4)" />
        <PlayerLink login={match.declarerLogin} className="font-semibold text-gold text-sm">
          {match.declarerLogin}
        </PlayerLink>
        <span className="text-muted-2 text-sm">a déclaré :</span>
        <span className="font-mono font-extrabold tabular-nums text-text-strong text-sm">
          {match.scoreDeclarer}
          <span className="text-muted mx-1">–</span>
          {match.scoreOpponent}
        </span>
        <GameTag game={match.game} />
        <span className="text-[10px] text-muted bg-bg-2 px-1.5 py-0.5 rounded">(eux – toi)</span>
        <span className="text-[11px] text-muted-2 hidden sm:inline">
          → Tu as {iWon ? 'gagné' : 'perdu'}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" loading={busy} onClick={handleConfirm}>✓ Confirmer</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setContesting(true)}
            className="text-red border-red/30 hover:border-red hover:bg-red/5 hover:text-red">
            Contester
          </Button>
        </div>
      </div>
      {contesting && (
        <ContestModal
          declarerLogin={match.declarerLogin}
          score={`${match.scoreDeclarer}–${match.scoreOpponent}`}
          busy={busy}
          onSubmit={handleContestSubmit}
          onClose={() => setContesting(false)}
        />
      )}
    </>
  );
}

function PendingWaitRow({ match, onCancel }: { match: PendingMatch; onCancel: () => void }) {
  return (
    <div className="rounded-xl p-3 flex flex-wrap items-center gap-2 text-sm border border-border/50 bg-white/[0.02]">
      <Clock className="w-4 h-4 text-muted-2 flex-shrink-0" strokeWidth={2} />
      <span className="text-muted-2">En attente de</span>
      <PlayerLink login={match.opponentLogin} className="font-semibold">{match.opponentLogin}</PlayerLink>
      <span className="font-mono font-extrabold tabular-nums text-text-strong">
        {match.scoreDeclarer}
        <span className="text-muted mx-1">–</span>
        {match.scoreOpponent}
      </span>
      <GameTag game={match.game} />
      <span className="ml-auto text-[10px] text-muted italic">confirmation en attente…</span>
      <button type="button" onClick={onCancel}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-2 hover:text-red hover:bg-red/10 transition-colors"
        title="Annuler" aria-label="Annuler">
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

// ─── Ligne de défi ────────────────────────────────────────────────────────────

interface ChallengeRowProps {
  challenge: Challenge;
  kind: Kind;
  myLogin: string | undefined;
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
}

function ChallengeRow({ challenge, kind, myLogin, lang, onAccept, onDecline }: ChallengeRowProps) {
  const opponent = challenge.challengerLogin === myLogin ? challenge.opponentLogin : challenge.challengerLogin;
  const when = fmtRelative(challenge.scheduledAt, lang);
  const [recording, setRecording] = useState(false);

  const KIND_ICON = { incoming: '⚔', outgoing: '→', accepted: '🎯' };
  const KIND_LABEL = { incoming: 'Défi reçu de', outgoing: 'Défi envoyé à', accepted: 'Match vs' };

  return (
    <div className="rounded-xl p-3 border border-border/50 bg-white/[0.02] hover:border-accent/30 transition-colors">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span aria-hidden>{KIND_ICON[kind]}</span>
        <span className="text-muted-2 text-[11px]">{KIND_LABEL[kind]}</span>
        <PlayerLink login={opponent} className="font-semibold text-sm">{opponent}</PlayerLink>
        {/* Game badge proéminent */}
        <GameTag game={challenge.game} />
        <span className={`text-[11px] ml-auto ${when.late ? 'text-red' : 'text-muted-2'}`}>{when.text}</span>

        {kind === 'incoming' && (
          <>
            <Button size="sm" onClick={onAccept}>Accepter</Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>Refuser</Button>
          </>
        )}
        {kind === 'outgoing' && (
          <Button size="sm" variant="ghost" onClick={onDecline}>Annuler</Button>
        )}
        {kind === 'accepted' && !recording && (
          <>
            <Button size="sm" onClick={() => setRecording(true)}>Saisir score</Button>
            <Button size="sm" variant="ghost" onClick={onDecline}>Annuler</Button>
          </>
        )}
      </div>
      {kind === 'accepted' && recording && (
        <RecordResultForm
          challengeId={challenge.id}
          game={challenge.game ?? 'babyfoot'}
          oppLogin={opponent}
          onDone={() => setRecording(false)}
        />
      )}
    </div>
  );
}

// ─── Formulaire d'enregistrement d'un résultat de défi ───────────────────────

function RecordResultForm({ challengeId, game, oppLogin, onDone }: {
  challengeId: string; game: Game; oppLogin: string; onDone: () => void;
}) {
  const { refresh } = useLeagueData();
  const flash = useFlash();
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const send = async (result: MatchResultInput) => {
    setBusy(true);
    try {
      await api.recordChallengeResult(challengeId, result);
      flash.show('Score envoyé — en attente de confirmation');
      await refresh();
      onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  if (game === 'chess') {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        <OutcomeButton kind="win" onClick={() => send({ scoreSelf: 1, scoreOpponent: 0, game: 'chess' })}>J'ai gagné</OutcomeButton>
        <OutcomeButton kind="loss" onClick={() => send({ scoreSelf: 0, scoreOpponent: 1, game: 'chess' })}>J'ai perdu</OutcomeButton>
      </div>
    );
  }
  if (game === 'smash' || game === 'streetfighter') {
    return (
      <div className="mt-3 text-center space-y-2">
        <p className="text-xs text-muted-2">Pour un set, utilise <span className="text-text font-semibold">« Déclarer une game »</span>.</p>
        <Button size="sm" variant="ghost" onClick={onDone} className="w-full">OK</Button>
      </div>
    );
  }

  if (iWon === null) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        <OutcomeButton kind="win" onClick={() => setIWon(true)}>J'ai gagné</OutcomeButton>
        <OutcomeButton kind="loss" onClick={() => setIWon(false)}>J'ai perdu</OutcomeButton>
      </div>
    );
  }

  const winnerLogin = iWon ? 'Moi' : oppLogin;
  const loserLogin = iWon ? oppLogin : 'Moi';

  return (
    <div className="mt-3 space-y-3">
      {/* Score visuel côte à côte */}
      <div className="flex items-stretch gap-2">
        {[{ login: winnerLogin, score: WINNING_SCORE, isWinner: true },
          { login: loserLogin, score: loserScore, isWinner: false }].map(({ login, score, isWinner }) => (
          <div key={login} className={`flex-1 rounded-xl flex flex-col items-center py-3 gap-1
            ${isWinner ? 'bg-gold/10 border border-gold/40' : loserScore < 0 ? 'bg-red/[0.07] border border-red/30' : 'bg-bg-2/60 border border-border/60'}`}>
            <span className="text-[9px] uppercase tracking-wider text-muted font-bold">{login === 'Moi' ? 'Toi' : login}</span>
            <span className={`font-display text-3xl font-black tabular-nums ${isWinner ? 'text-gold' : loserScore < 0 ? 'text-red' : 'text-text-strong'}`}>
              {score}
            </span>
            {isWinner && <span className="text-[8px] text-gold/50 font-extrabold uppercase tracking-wider">🔒</span>}
            {!isWinner && <span className="text-[8px] text-muted-2 font-extrabold uppercase tracking-wider">← glisser</span>}
          </div>
        ))}
      </div>
      <AbacusSlider value={loserScore} onChange={setLoserScore} min={LOSER_SCORE_MIN} max={LOSER_SCORE_MAX} />
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => setIWon(null)} className="flex-none">←</Button>
        <Button size="sm" loading={busy}
          onClick={() => send({
            scoreSelf: iWon ? WINNING_SCORE : loserScore,
            scoreOpponent: iWon ? loserScore : WINNING_SCORE,
            game: 'babyfoot',
          })}
          className="flex-1">Envoyer</Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="flex-none">Annuler</Button>
      </div>
    </div>
  );
}

