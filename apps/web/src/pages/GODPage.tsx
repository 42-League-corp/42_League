import { useEffect, useState, useCallback, type ReactNode, type ClipboardEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useServerEvents } from '../hooks/useServerEvents';
import {
  api,
  type AdminUser,
  type RejectedMatch,
  type ModerationStats,
  type FeatureRequestWithAuthor,
  type BugReportWithAuthor,
  type PlayedMatch,
  type PendingMatch,
  type SuspiciousFlag,
  type AdminAuditEntry,
  type AdminAuditAction,
  type AllHistoryEvent,
  type AllHistoryEventType,
  type Season,
  type Tournament,
} from '../lib/api';

type Tab = 'users' | 'moderation' | 'rejets' | 'matches' | 'pending' | 'ideas' | 'bugs' | 'alertes' | 'audit' | 'history' | 'seasons' | 'tournaments';
type Role = 'ADMIN' | 'SUPERADMIN';

// Temps réel : événements SSE qui doivent rafraîchir le panel.
//  - `data:update`  : émis sur toute mutation /admin/* (actions d'un autre admin).
//  - `panel:update` : émis sur toute mutation matchs / défis / idées (actions des
//                     joueurs, qui sinon ne sont notifiées qu'aux intéressés).
// Chaque onglet s'y abonne et recharge ses données en silence (sans spinner).
const PANEL_EVENTS = ['data:update', 'panel:update'];

// ── Shared primitives ──────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (role === 'SUPERADMIN')
    return <span className="px-1.5 py-0.5 text-xs bg-amber-400/15 text-amber-400 rounded font-mono tracking-wide">SUPERADMIN</span>;
  if (role === 'ADMIN')
    return <span className="px-1.5 py-0.5 text-xs bg-blue-400/15 text-blue-400 rounded font-mono tracking-wide">ADMIN</span>;
  return <span className="px-1.5 py-0.5 text-xs bg-zinc-700/50 text-zinc-400 rounded font-mono tracking-wide">USER</span>;
}

// Pastilles des modes auxquels le joueur adhère, avec son ELO par discipline en tooltip.
function GameModeBadges({ user }: { user: AdminUser }) {
  const games = (user.games as string[] | undefined) ?? ['babyfoot'];
  const defs: { id: string; label: string; cls: string; elo: number }[] = [
    { id: 'babyfoot', label: 'B', cls: 'bg-amber-400/15 text-amber-400', elo: user.elo },
    { id: 'smash', label: 'S', cls: 'bg-red-400/15 text-red-400', elo: user.eloSmash ?? 1000 },
    { id: 'chess', label: 'É', cls: 'bg-emerald-400/15 text-emerald-400', elo: user.eloChess ?? 1000 },
    { id: 'streetfighter', label: 'SF', cls: 'bg-orange-400/15 text-orange-400', elo: user.eloSf ?? 1000 },
  ];
  return (
    <span className="inline-flex gap-1">
      {defs.map((d) => {
        const on = games.includes(d.id);
        return (
          <span
            key={d.id}
            title={`${d.id} · ${on ? `${d.elo} ELO` : 'non inscrit'}`}
            className={`w-5 h-5 grid place-items-center rounded text-[10px] font-mono font-bold ${
              on ? d.cls : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            {d.label}
          </span>
        );
      })}
    </span>
  );
}

function StatusBadge({ banned }: { banned: boolean }) {
  if (banned)
    return <span className="px-1.5 py-0.5 text-xs bg-red-400/15 text-red-400 rounded font-mono">BANNI</span>;
  return <span className="px-1.5 py-0.5 text-xs bg-emerald-400/15 text-emerald-400 rounded font-mono">ACTIF</span>;
}

function FRStatusBadge({ status }: { status: string }) {
  if (status === 'accepted')
    return <span className="px-1.5 py-0.5 text-xs bg-emerald-400/15 text-emerald-400 rounded font-mono">ACCEPTÉE</span>;
  if (status === 'rejected')
    return <span className="px-1.5 py-0.5 text-xs bg-red-400/15 text-red-400 rounded font-mono">REJETÉE</span>;
  return <span className="px-1.5 py-0.5 text-xs bg-yellow-400/15 text-yellow-400 rounded font-mono">EN ATTENTE</span>;
}

function BugStatusBadge({ status }: { status: string }) {
  if (status === 'resolved')
    return <span className="px-1.5 py-0.5 text-xs bg-emerald-400/15 text-emerald-400 rounded font-mono">RÉSOLU</span>;
  if (status === 'closed')
    return <span className="px-1.5 py-0.5 text-xs bg-zinc-400/15 text-zinc-400 rounded font-mono">FERMÉ</span>;
  return <span className="px-1.5 py-0.5 text-xs bg-red-400/15 text-red-400 rounded font-mono">OUVERT</span>;
}

function Btn({
  onClick,
  variant = 'default',
  disabled,
  children,
  className = '',
}: {
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warn' | 'ghost';
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const base = 'px-2 py-1 text-xs rounded font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const variants = {
    default: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
    danger: 'bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30',
    success: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30',
    warn: 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 border border-yellow-500/30',
    ghost: 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 ${className}`}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2 px-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Primitives : confirmation soignée + mode sudo + sélection multi-lignes ───

function ConfirmModal({
  message,
  danger,
  confirmLabel = 'Confirmer',
  onConfirm,
  onCancel,
}: {
  message: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/70 font-mono" onClick={onCancel}>
      <div
        className={`bg-zinc-900 border rounded-lg w-full max-w-sm p-5 ${danger ? 'border-red-500/40' : 'border-zinc-700'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-zinc-200 mb-4 whitespace-pre-wrap leading-relaxed">{message}</div>
        <div className="flex gap-2 justify-end">
          <Btn variant="ghost" onClick={onCancel}>Annuler</Btn>
          <Btn variant={danger ? 'danger' : 'default'} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

/** Confirmation impérative : requestConfirm(msg) renvoie une Promise<boolean>. */
function useConfirmDialog() {
  const [state, setState] = useState<
    { message: string; danger?: boolean; confirmLabel?: string; resolve: (v: boolean) => void } | null
  >(null);
  const requestConfirm = useCallback(
    (message: string, opts?: { danger?: boolean; confirmLabel?: string }) =>
      new Promise<boolean>((resolve) =>
        setState({ message, danger: opts?.danger, confirmLabel: opts?.confirmLabel, resolve }),
      ),
    [],
  );
  const confirmNode = state ? (
    <ConfirmModal
      message={state.message}
      danger={state.danger}
      confirmLabel={state.confirmLabel}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  ) : null;
  return { requestConfirm, confirmNode };
}

/** Sélection multi-lignes (par id/login). */
function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = (ids: string[]) =>
    setSelected((prev) => (ids.length > 0 && ids.every((i) => prev.has(i)) ? new Set() : new Set(ids)));
  const clear = () => setSelected(new Set());
  return { selected, toggle, toggleAll, clear };
}

function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="w-3.5 h-3.5 cursor-pointer accent-red-500 align-middle"
    />
  );
}

/**
 * Barre en haut d'un tableau : interrupteur « sudo » (activation confirmée ;
 * une fois ON, les actions destructrices ne re-demandent plus confirmation) +
 * bouton de suppression groupée de la sélection.
 */
function SudoBar({
  sudo,
  onToggle,
  selectedCount,
  onBulkDelete,
  bulkLabel = 'Supprimer la sélection',
}: {
  sudo: boolean;
  onToggle: () => void;
  selectedCount?: number;
  onBulkDelete?: () => void;
  bulkLabel?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none"
      >
        <span className={`relative w-9 h-5 rounded-full transition-colors ${sudo ? 'bg-red-500/70' : 'bg-zinc-700'}`}>
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sudo ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        <span className={sudo ? 'text-red-400 font-bold' : 'text-zinc-400'}>MODE SUDO {sudo ? 'ON' : 'OFF'}</span>
        <span className="text-[10px] text-zinc-600">
          {sudo ? '· suppressions sans confirmation' : '· suppressions confirmées'}
        </span>
      </button>
      {onBulkDelete && (selectedCount ?? 0) > 0 && (
        <Btn variant="danger" onClick={onBulkDelete} className="border border-red-500/40">
          {bulkLabel} ({selectedCount})
        </Btn>
      )}
    </div>
  );
}

// ── Stats edit modal ───────────────────────────────────────────────────────

function StatsEditModal({
  user,
  onClose,
  onSave,
}: {
  user: AdminUser;
  onClose: () => void;
  onSave: () => void;
}) {
  const [elo, setElo] = useState(String(user.elo));
  const [matches, setMatches] = useState(String(user.matchesPlayed));
  const [dodges, setDodges] = useState(String(user.dodgeCount));
  const [trophies, setTrophies] = useState(String(user.tournamentsWon));
  const [eloS, setEloS] = useState(String(user.eloSmash ?? 1000));
  const [matchesS, setMatchesS] = useState(String(user.matchesPlayedSmash ?? 0));
  const [trophiesS, setTrophiesS] = useState(String(user.tournamentsWonSmash ?? 0));
  const [eloC, setEloC] = useState(String(user.eloChess ?? 1000));
  const [matchesC, setMatchesC] = useState(String(user.matchesPlayedChess ?? 0));
  const [trophiesC, setTrophiesC] = useState(String(user.tournamentsWonChess ?? 0));
  const [eloSf, setEloSf] = useState(String(user.eloSf ?? 1000));
  const [matchesSf, setMatchesSf] = useState(String(user.matchesPlayedSf ?? 0));
  const [trophiesSf, setTrophiesSf] = useState(String(user.tournamentsWonSf ?? 0));
  const [games, setGames] = useState<Set<'babyfoot' | 'smash' | 'chess' | 'streetfighter'>>(
    new Set((user.games as ('babyfoot' | 'smash' | 'chess' | 'streetfighter')[] | undefined) ?? ['babyfoot']),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleGame = (g: 'babyfoot' | 'smash' | 'chess' | 'streetfighter') =>
    setGames((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  async function handleSave() {
    if (games.size === 0) {
      setError('Au moins un mode doit rester actif');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.adminSetStats(user.login, {
        elo: Number(elo),
        matchesPlayed: Number(matches),
        dodgeCount: Number(dodges),
        tournamentsWon: Number(trophies),
        eloSmash: Number(eloS),
        matchesPlayedSmash: Number(matchesS),
        tournamentsWonSmash: Number(trophiesS),
        eloChess: Number(eloC),
        matchesPlayedChess: Number(matchesC),
        tournamentsWonChess: Number(trophiesC),
        eloSf: Number(eloSf),
        matchesPlayedSf: Number(matchesSf),
        tournamentsWonSf: Number(trophiesSf),
        games: [...games],
      });
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  const GAME_GROUPS: { title: string; accent: string; rows: { label: string; value: string; set: (v: string) => void }[] }[] = [
    {
      title: '⚽ Babyfoot',
      accent: 'text-amber-400',
      rows: [
        { label: 'ELO', value: elo, set: setElo },
        { label: 'Matches', value: matches, set: setMatches },
        { label: 'Tournois gagnés', value: trophies, set: setTrophies },
      ],
    },
    {
      title: '🎮 Smash',
      accent: 'text-red-400',
      rows: [
        { label: 'ELO', value: eloS, set: setEloS },
        { label: 'Matches', value: matchesS, set: setMatchesS },
        { label: 'Tournois gagnés', value: trophiesS, set: setTrophiesS },
      ],
    },
    {
      title: '♟️ Échecs',
      accent: 'text-emerald-400',
      rows: [
        { label: 'ELO', value: eloC, set: setEloC },
        { label: 'Matches', value: matchesC, set: setMatchesC },
        { label: 'Tournois gagnés', value: trophiesC, set: setTrophiesC },
      ],
    },
    {
      title: '🥊 Street Fighter',
      accent: 'text-orange-400',
      rows: [
        { label: 'ELO', value: eloSf, set: setEloSf },
        { label: 'Matches', value: matchesSf, set: setMatchesSf },
        { label: 'Tournois gagnés', value: trophiesSf, set: setTrophiesSf },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[28rem] max-w-full max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-mono text-zinc-300 mb-4">
          Modifier stats — <span className="text-zinc-100 font-bold">{user.login}</span>
        </div>

        {/* Adhésion aux modes */}
        <div className="mb-4">
          <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">Modes actifs</div>
          <div className="flex gap-2">
            {(['babyfoot', 'smash', 'chess', 'streetfighter'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGame(g)}
                className={`px-3 py-1.5 rounded font-mono text-xs border transition-colors ${
                  games.has(g)
                    ? 'bg-zinc-100/10 border-zinc-400 text-zinc-100'
                    : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Stats par discipline */}
        <div className="space-y-4">
          {GAME_GROUPS.map((grp) => (
            <div key={grp.title}>
              <div className={`text-xs font-mono uppercase tracking-widest mb-2 ${grp.accent}`}>{grp.title}</div>
              <div className="space-y-2">
                {grp.rows.map(({ label, value, set }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 w-28">{label}</span>
                    <Input type="number" value={value} onChange={set} className="flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {/* Dodges (transversal) */}
          <div className="flex items-center gap-3 border-t border-zinc-800 pt-3">
            <span className="text-xs font-mono text-zinc-400 w-28">Dodges</span>
            <Input type="number" value={dodges} onChange={setDodges} className="flex-1" />
          </div>
        </div>

        {error && <div className="mt-3 text-xs text-red-400 font-mono">{error}</div>}
        <div className="mt-5 flex gap-2 justify-end">
          <Btn onClick={onClose} variant="ghost">Annuler</Btn>
          <Btn onClick={handleSave} disabled={saving} variant="default">
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Reset total de la ligue (SUPERADMIN) ───────────────────────────────────
// Phrase à recopier À LA MAIN (copier-coller / glisser bloqués) pour déverrouiller
// le bouton. Doit être identique côté backend (RESET_CONFIRM_PHRASE).
const RESET_CONFIRM_PHRASE = 'oui je suis sure de ce que je fais';

function ResetDatabaseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ removedUsers: number; resetUsers: number } | null>(null);

  const blockPaste = (e: ClipboardEvent | DragEvent) => {
    e.preventDefault();
    setError('Copier-coller interdit — recopie la phrase à la main.');
  };

  const ok = typed === RESET_CONFIRM_PHRASE;

  async function handleReset() {
    if (!ok) return;
    setResetting(true);
    setError('');
    try {
      const r = await api.adminResetDatabase(typed);
      setResult({ removedUsers: r.removedUsers, resetUsers: r.resetUsers });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-red-500/40 rounded-lg p-6 w-[28rem] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <>
            <div className="text-sm font-mono text-emerald-400 mb-3 font-bold">✓ Ligue réinitialisée</div>
            <div className="text-xs font-mono text-zinc-400 space-y-1">
              <div>{result.resetUsers} joueur{result.resetUsers !== 1 ? 's' : ''} remis à zéro (ELO 1000).</div>
              <div>{result.removedUsers} compte{result.removedUsers !== 1 ? 's' : ''} supprimé{result.removedUsers !== 1 ? 's' : ''} (désactivés / supprimés).</div>
              <div className="text-zinc-500">Tout l'historique de jeu a été effacé.</div>
            </div>
            <div className="mt-5 flex justify-end">
              <Btn onClick={onClose} variant="default">Fermer</Btn>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💣</span>
              <span className="text-sm font-mono text-red-400 font-bold uppercase tracking-widest">Reset total de la ligue</span>
            </div>
            <div className="text-xs font-mono text-zinc-400 leading-relaxed space-y-2 mb-4">
              <p>Cette action est <span className="text-red-400 font-bold">irréversible</span>. Elle va :</p>
              <ul className="list-disc list-inside text-zinc-500 space-y-0.5">
                <li>supprimer <span className="text-zinc-300">tous les matchs</span>, défis, ops, rejets et tournois ;</li>
                <li>remettre chaque joueur à <span className="text-zinc-300">ELO 1000</span>, stats et trophées à 0 ;</li>
                <li>supprimer les comptes <span className="text-zinc-300">désactivés / supprimés</span>.</li>
              </ul>
              <p className="text-zinc-500">Les SUPERADMIN et les comptes actifs sont conservés (mais remis à zéro).</p>
            </div>
            <div className="text-xs font-mono text-zinc-400 mb-2">
              Pour confirmer, recopie à la main (le copier-coller est bloqué) :
            </div>
            <div className="bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2 mb-2 text-sm font-mono text-zinc-200 select-none">
              {RESET_CONFIRM_PHRASE}
            </div>
            <input
              type="text"
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(''); }}
              onPaste={blockPaste}
              onDrop={blockPaste}
              onDragOver={(e) => e.preventDefault()}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Recopie la phrase ici…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500/60"
            />
            {error && <div className="mt-3 text-xs text-red-400 font-mono">{error}</div>}
            <div className="mt-5 flex gap-2 justify-end">
              <Btn onClick={onClose} variant="ghost">Annuler</Btn>
              <Btn onClick={handleReset} disabled={!ok || resetting} variant="danger">
                {resetting ? 'Reset en cours…' : 'Tout réinitialiser'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab: UTILISATEURS ──────────────────────────────────────────────────────

// Logins hardcodés côté serveur — on ne leur propose pas le toggle staging
// (ils ont accès quoi qu'il arrive, et le backend les protège de toute façon).
const HARDCODED_SUPERADMINS = new Set(['abidaux', 'throbert']);

function UsersTab({ myRole, myLogin }: { myRole: Role; myLogin: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [editingStats, setEditingStats] = useState<AdminUser | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState('');
  const [sudo, setSudo] = useState(false);
  const { requestConfirm, confirmNode } = useConfirmDialog();
  const { selected, toggle, toggleAll, clear } = useSelection();

  // Création d'un faux joueur (SUPERADMIN).
  const [newLogin, setNewLogin] = useState('');
  const [newCampus, setNewCampus] = useState('Le Havre');
  const [newElo, setNewElo] = useState('1000');
  const [creating, setCreating] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.adminUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = users.filter((u) => u.login.toLowerCase().includes(filter.toLowerCase()));

  async function withPending(login: string, fn: () => Promise<unknown>) {
    setPending(login);
    setError('');
    try { await fn(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setPending(null); }
  }

  async function createUser() {
    const login = newLogin.trim();
    if (!login) return;
    setCreating(true);
    setError('');
    try {
      await api.adminCreateUser(login, {
        campus: newCampus.trim() || undefined,
        elo: Number(newElo) || 1000,
      });
      setNewLogin('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  }

  // Confirme l'action, SAUF si le mode sudo est actif (le toggle a déjà été confirmé).
  async function confirmOrSudo(message: string, confirmLabel = 'Supprimer') {
    return sudo ? true : requestConfirm(message, { danger: true, confirmLabel });
  }
  async function toggleSudo() {
    if (sudo) {
      setSudo(false);
      return;
    }
    const ok = await requestConfirm(
      'Activer le mode SUDO ?\nLes suppressions / bans ne demanderont plus de confirmation dans ce tableau.',
      { danger: true, confirmLabel: 'Activer sudo' },
    );
    if (ok) setSudo(true);
  }

  // Comptes supprimables : faux joueurs (sans 42), hors soi-même et superadmins.
  const deletableLogins =
    myRole === 'SUPERADMIN'
      ? filtered.filter((u) => u.ftId === null && u.login !== myLogin && u.role !== 'SUPERADMIN').map((u) => u.login)
      : [];

  async function deleteFakeUser(login: string) {
    if (!(await confirmOrSudo(`Supprimer DÉFINITIVEMENT le faux joueur "${login}" et toutes ses données ? (irréversible)`)))
      return;
    await withPending(login, () => api.adminDeleteUser(login));
  }

  async function banUser(login: string) {
    if (!(await confirmOrSudo(`Bannir @${login} ? Ses défis/tournois en cours seront annulés.`, 'Bannir'))) return;
    await withPending(login, () => api.adminBanUser(login));
  }

  async function bulkDelete() {
    const ids = [...selected].filter((l) => deletableLogins.includes(l));
    if (ids.length === 0) return;
    if (!(await confirmOrSudo(`Supprimer DÉFINITIVEMENT ${ids.length} faux joueur(s) ? (irréversible)`))) return;
    setError('');
    for (const l of ids) await api.adminDeleteUser(l).catch((e) => setError(String(e)));
    clear();
    load();
  }

  async function toggleStaging(login: string, currentRole: string) {
    const grant = currentRole !== 'SUPERADMIN';
    const msg = grant
      ? `Donner l'accès à staging.42league.fr à @${login} ?`
      : `Retirer l'accès staging à @${login} ? Son rôle repassera à USER.`;
    if (!(await requestConfirm(msg, { danger: !grant, confirmLabel: grant ? 'Accorder' : 'Retirer' }))) return;
    await withPending(login, () => api.setStagingAccess(login, grant));
  }

  return (
    <div className="p-4">
      {editingStats && (
        <StatsEditModal user={editingStats} onClose={() => setEditingStats(null)} onSave={load} />
      )}
      {showReset && (
        <ResetDatabaseModal onClose={() => setShowReset(false)} onDone={() => load()} />
      )}

      {myRole === 'SUPERADMIN' && (
        <div className="mb-4 bg-red-500/5 border border-red-500/30 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-0.5">
              💣 Zone de danger
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Reset complet : supprime matchs &amp; tournois, remet tous les joueurs à zéro (ELO 1000), retire les comptes désactivés/supprimés. Irréversible.
            </div>
          </div>
          <Btn onClick={() => setShowReset(true)} variant="danger" className="border border-red-500/40 px-3 py-1.5">
            Réinitialiser la ligue
          </Btn>
        </div>
      )}

      {myRole === 'SUPERADMIN' && (
        <div className="mb-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-wrap items-end gap-3">
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest w-full mb-1">
            Créer un faux joueur
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Login</span>
            <Input value={newLogin} onChange={setNewLogin} placeholder="ex. test9" className="w-40" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Campus</span>
            <Input value={newCampus} onChange={setNewCampus} placeholder="Le Havre" className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">ELO</span>
            <Input type="number" value={newElo} onChange={setNewElo} className="w-24" />
          </div>
          <Btn onClick={createUser} disabled={creating || !newLogin.trim()} variant="success">
            {creating ? 'Création…' : '+ Créer'}
          </Btn>
          <span className="text-[10px] text-zinc-600 font-mono">
            Compte factice (sans 42) — supprimable ensuite.
          </span>
        </div>
      )}

      {confirmNode}

      <div className="mb-3 flex items-center gap-3">
        <Input value={filter} onChange={setFilter} placeholder="Filtrer par login…" className="w-64" />
        <span className="text-zinc-500 text-xs font-mono">{filtered.length} utilisateurs</span>
      </div>

      <SudoBar
        sudo={sudo}
        onToggle={toggleSudo}
        selectedCount={selected.size}
        onBulkDelete={deletableLogins.length > 0 ? bulkDelete : undefined}
        bulkLabel="Supprimer les joueurs"
      />

      {error && <div className="mb-3 text-xs text-red-400 font-mono">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="py-2 px-3 w-8">
                  {deletableLogins.length > 0 && (
                    <Check
                      checked={deletableLogins.every((l) => selected.has(l))}
                      onChange={() => toggleAll(deletableLogins)}
                    />
                  )}
                </th>
                <th className="text-left py-2 px-3">Login</th>
                <th className="text-left py-2 px-3">Rôle</th>
                <th className="text-left py-2 px-3">Modes</th>
                <th className="text-right py-2 px-3">ELO</th>
                <th className="text-right py-2 px-3">Matches</th>
                <th className="text-right py-2 px-3">Dodges</th>
                <th className="text-right py-2 px-3">🏆</th>
                <th className="text-left py-2 px-3">Statut</th>
                <th className="text-left py-2 px-3">Campus</th>
                <th className="text-right py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.login === myLogin;
                const isHardcoded = HARDCODED_SUPERADMINS.has(u.login.toLowerCase());
                const isSuperAdmin = u.role === 'SUPERADMIN';
                // Hardcodés + soi-même : on ne touche pas au rôle ni au ban.
                const isLocked = isSelf || isHardcoded;
                const isDeletable = deletableLogins.includes(u.login);
                return (
                  <tr key={u.login} className={`border-b border-zinc-800/40 hover:bg-zinc-900/60 transition-colors ${selected.has(u.login) ? 'bg-red-500/5' : ''}`}>
                    <td className="py-2 px-3">
                      {isDeletable && <Check checked={selected.has(u.login)} onChange={() => toggle(u.login)} />}
                    </td>
                    <td className="py-2 px-3 text-zinc-100">{u.login}</td>
                    <td className="py-2 px-3"><RoleBadge role={u.role} /></td>
                    <td className="py-2 px-3"><GameModeBadges user={u} /></td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-100">{u.elo}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{u.matchesPlayed}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{u.dodgeCount}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{u.tournamentsWon}</td>
                    <td className="py-2 px-3"><StatusBadge banned={!!u.bannedAt} /></td>
                    <td className="py-2 px-3 text-zinc-500 text-xs">{u.campus ?? '—'}</td>
                    <td className="py-2 px-3">
                      {isLocked ? (
                        // Superadmins hardcodés : seul le bouton staging est masqué
                        // (accès permanent), mais on affiche quand même leur statut.
                        <span className="text-zinc-600 text-xs font-mono">permanent</span>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {myRole === 'SUPERADMIN' && !isSuperAdmin && (
                            u.role === 'USER'
                              ? <Btn onClick={() => withPending(u.login, () => api.setUserRole(u.login, 'ADMIN'))} disabled={pending === u.login} variant="default">→ ADMIN</Btn>
                              : u.role === 'ADMIN'
                                ? <Btn onClick={() => withPending(u.login, () => api.setUserRole(u.login, 'USER'))} disabled={pending === u.login} variant="ghost">→ USER</Btn>
                                : null
                          )}
                          {/* Accès staging — visible aux SUPERADMIN hardcodés uniquement */}
                          {myRole === 'SUPERADMIN' && (
                            isSuperAdmin
                              ? <Btn onClick={() => toggleStaging(u.login, u.role)} disabled={pending === u.login} variant="warn" className="border border-yellow-500/40">🔒 Retirer staging</Btn>
                              : <Btn onClick={() => toggleStaging(u.login, u.role)} disabled={pending === u.login} variant="ghost" className="border border-zinc-600">🔒 Staging</Btn>
                          )}
                          {u.bannedAt
                            ? <Btn onClick={() => withPending(u.login, () => api.adminUnbanUser(u.login))} disabled={pending === u.login} variant="success">Unban</Btn>
                            : <Btn onClick={() => banUser(u.login)} disabled={pending === u.login} variant="danger">Ban</Btn>
                          }
                          <Btn onClick={() => setEditingStats(u)} variant="ghost">Stats</Btn>
                          {myRole === 'SUPERADMIN' && u.ftId === null && (
                            <Btn onClick={() => deleteFakeUser(u.login)} disabled={pending === u.login} variant="danger" className="border border-red-500/40">Suppr</Btn>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: MODÉRATION ────────────────────────────────────────────────────────

function ModerationTab() {
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');

  async function lookup() {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setStats(null);
    try {
      const data = await api.adminModerationStats(query.trim());
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Joueur introuvable');
    } finally {
      setLoading(false);
    }
  }

  async function handleBan() {
    if (!stats) return;
    setPending('ban');
    try {
      await api.adminBanUser(stats.user.login);
      const data = await api.adminModerationStats(stats.user.login);
      setStats(data);
    } finally { setPending(''); }
  }

  async function handleUnban() {
    if (!stats) return;
    setPending('unban');
    try {
      await api.adminUnbanUser(stats.user.login);
      const data = await api.adminModerationStats(stats.user.login);
      setStats(data);
    } finally { setPending(''); }
  }

  // Temps réel : si un joueur est affiché, on rafraîchit ses stats en silence.
  useServerEvents(() => {
    if (!stats) return;
    api.adminModerationStats(stats.user.login).then(setStats).catch(() => {});
  }, PANEL_EVENTS);

  const u = stats?.user;

  return (
    <div className="p-4">
      <div className="mb-5 flex items-center gap-3">
        <Input
          value={query}
          onChange={setQuery}
          placeholder="Login du joueur…"
          className="w-64"
        />
        <Btn
          onClick={lookup}
          disabled={loading || !query.trim()}
          variant="default"
        >
          {loading ? 'Analyse…' : 'Analyser'}
        </Btn>
      </div>
      {error && <div className="text-xs text-red-400 font-mono mb-4">{error}</div>}

      {u && stats && (
        <div className="space-y-5">
          {/* Header */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-mono text-zinc-100 font-bold">{u.login}</span>
                <RoleBadge role={u.role} />
                <StatusBadge banned={!!u.bannedAt} />
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: 'ELO', value: u.elo },
                  { label: 'Matches', value: u.matchesPlayed },
                  { label: 'Dodges', value: u.dodgeCount },
                  { label: 'Trophées', value: u.tournamentsWon },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-zinc-800/60 rounded p-2">
                    <div className="text-xl font-mono font-bold text-zinc-100 tabular-nums">{value}</div>
                    <div className="text-xs text-zinc-500 uppercase">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-center">
                {[
                  { label: 'Rejets émis', value: stats.rejectionsEmitted.length, color: 'text-orange-400' },
                  { label: 'Rejets reçus', value: stats.rejectionsReceived.length, color: 'text-red-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-zinc-800/60 rounded p-2">
                    <div className={`text-xl font-mono font-bold tabular-nums ${color}`}>{value}</div>
                    <div className="text-xs text-zinc-500 uppercase">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {u.bannedAt
                ? <Btn onClick={handleUnban} disabled={!!pending} variant="success">Unban</Btn>
                : <Btn onClick={handleBan} disabled={!!pending} variant="danger">Bannir</Btn>
              }
            </div>
          </div>

          {/* Top opponents */}
          <Section title="Top adversaires (50 derniers matchs)">
            <div className="flex flex-wrap gap-2">
              {stats.topOpponents.length === 0 ? (
                <span className="text-zinc-600 text-xs font-mono">Aucun match</span>
              ) : (
                stats.topOpponents.map(({ login, count }) => (
                  <div key={login} className="bg-zinc-800 rounded px-3 py-1.5 flex items-center gap-2">
                    <span className="text-zinc-200 font-mono text-sm">{login}</span>
                    <span className="text-zinc-500 font-mono text-xs">{count} match{count > 1 ? 's' : ''}</span>
                  </div>
                ))
              )}
            </div>
          </Section>

          {/* Match history */}
          <Section title={`Historique (${stats.recentMatches.length} matchs)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                    <th className="text-left py-1.5 px-2">Date</th>
                    <th className="text-left py-1.5 px-2">Joueur A</th>
                    <th className="text-center py-1.5 px-2">Score</th>
                    <th className="text-left py-1.5 px-2">Joueur B</th>
                    <th className="text-right py-1.5 px-2">ΔA</th>
                    <th className="text-right py-1.5 px-2">ΔB</th>
                    <th className="text-center py-1.5 px-2">ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentMatches.map((m) => {
                    const isWinner = (m.playerALogin === u.login && m.winner === 'A') || (m.playerBLogin === u.login && m.winner === 'B');
                    return (
                      <tr key={m.id} className={`border-b border-zinc-800/40 ${isWinner ? 'bg-emerald-400/5' : 'bg-red-400/5'}`}>
                        <td className="py-1.5 px-2 text-zinc-500">{fmtDate(m.playedAt)}</td>
                        <td className={`py-1.5 px-2 ${m.winner === 'A' ? 'text-emerald-400' : 'text-zinc-300'}`}>{m.playerALogin}</td>
                        <td className="py-1.5 px-2 text-center tabular-nums text-zinc-100">{m.scoreA}–{m.scoreB}</td>
                        <td className={`py-1.5 px-2 ${m.winner === 'B' ? 'text-emerald-400' : 'text-zinc-300'}`}>{m.playerBLogin}</td>
                        <td className={`py-1.5 px-2 text-right tabular-nums ${m.deltaA >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.deltaA > 0 ? '+' : ''}{m.deltaA}</td>
                        <td className={`py-1.5 px-2 text-right tabular-nums ${m.deltaB >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.deltaB > 0 ? '+' : ''}{m.deltaB}</td>
                        <td className="py-1.5 px-2 text-center">{m.countedForElo ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Rejections */}
          {stats.rejectionsEmitted.length > 0 && (
            <Section title={`Rejets émis par ${u.login} (${stats.rejectionsEmitted.length})`}>
              <RejectionTable rows={stats.rejectionsEmitted} perspective="emitted" />
            </Section>
          )}
          {stats.rejectionsReceived.length > 0 && (
            <Section title={`Rejets reçus par ${u.login} (${stats.rejectionsReceived.length})`}>
              <RejectionTable rows={stats.rejectionsReceived} perspective="received" />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: REJETS ────────────────────────────────────────────────────────────

function RejectionTable({ rows }: { rows: RejectedMatch[]; perspective?: 'emitted' | 'received' | 'all' }) {
  return (
    <table className="w-full text-xs font-mono border-collapse">
      <thead>
        <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
          <th className="text-left py-1.5 px-2">Date</th>
          <th className="text-left py-1.5 px-2">Déclarant</th>
          <th className="text-left py-1.5 px-2">Opposant</th>
          <th className="text-center py-1.5 px-2">Score</th>
          <th className="text-left py-1.5 px-2">Raison</th>
          <th className="text-left py-1.5 px-2">Message</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors">
            <td className="py-1.5 px-2 text-zinc-500">{fmtDate(r.rejectedAt)}</td>
            <td className="py-1.5 px-2 text-zinc-300">{r.declarerLogin}</td>
            <td className="py-1.5 px-2 text-zinc-300">{r.opponentLogin}</td>
            <td className="py-1.5 px-2 text-center tabular-nums text-zinc-400">{r.scoreDeclarer}–{r.scoreOpponent}</td>
            <td className="py-1.5 px-2">
              <span className={`px-1 py-0.5 rounded text-xs ${r.contestReason === 'never_played' ? 'bg-red-400/15 text-red-400' : 'bg-orange-400/15 text-orange-400'}`}>
                {r.contestReason === 'never_played' ? 'Jamais joué' : 'Score incorrect'}
              </span>
            </td>
            <td className="py-1.5 px-2 text-zinc-400 max-w-xs truncate" title={r.contestMessage}>{r.contestMessage || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RejetsTab() {
  const [rows, setRows] = useState<RejectedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.adminRejectedMatches()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = rows.filter(
    (r) =>
      r.declarerLogin.includes(filter) ||
      r.opponentLogin.includes(filter) ||
      r.contestMessage.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-3">
        <Input value={filter} onChange={setFilter} placeholder="Filtrer par login ou message…" className="w-72" />
        <span className="text-zinc-500 text-xs font-mono">{filtered.length} rejet{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucun rejet enregistré.</div>
      ) : (
        <div className="overflow-x-auto">
          <RejectionTable rows={filtered} perspective="all" />
        </div>
      )}
    </div>
  );
}

// ── Tab: MATCHES ───────────────────────────────────────────────────────────

function MatchesTab() {
  const [matches, setMatches] = useState<PlayedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlayerA, setEditPlayerA] = useState('');
  const [editPlayerB, setEditPlayerB] = useState('');
  const [editA, setEditA] = useState('');
  const [editB, setEditB] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sudo, setSudo] = useState(false);
  const { requestConfirm, confirmNode } = useConfirmDialog();
  const { selected, toggle, toggleAll, clear } = useSelection();

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.playedMatches()
      .then(setMatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = matches.filter(
    (m) => m.playerALogin.includes(filter) || m.playerBLogin.includes(filter),
  ).slice(0, 200);

  function startEdit(m: PlayedMatch) {
    setEditId(m.id);
    setEditPlayerA(m.playerALogin);
    setEditPlayerB(m.playerBLogin);
    setEditA(String(m.scoreA));
    setEditB(String(m.scoreB));
  }

  async function saveEdit(id: string) {
    const playerALogin = editPlayerA.trim();
    const playerBLogin = editPlayerB.trim();
    if (!playerALogin || !playerBLogin) {
      setError('Les deux joueurs sont obligatoires.');
      return;
    }
    if (playerALogin === playerBLogin) {
      setError('Les deux joueurs doivent être différents.');
      return;
    }
    setPending(id);
    setError('');
    try {
      await api.adminEditMatch(id, {
        scoreA: Number(editA),
        scoreB: Number(editB),
        playerALogin,
        playerBLogin,
      });
      setEditId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setPending(null); }
  }

  async function confirmOrSudo(message: string) {
    return sudo ? true : requestConfirm(message, { danger: true, confirmLabel: 'Supprimer' });
  }
  async function toggleSudo() {
    if (sudo) {
      setSudo(false);
      return;
    }
    const ok = await requestConfirm(
      'Activer le mode SUDO ?\nLes suppressions de matchs ne demanderont plus de confirmation.',
      { danger: true, confirmLabel: 'Activer sudo' },
    );
    if (ok) setSudo(true);
  }

  async function deleteMatch(id: string) {
    if (!(await confirmOrSudo("Supprimer ce match ? L'ELO sera reversé."))) return;
    setPending(id);
    setError('');
    try {
      await api.adminDeleteMatch(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setPending(null); }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!(await confirmOrSudo(`Supprimer ${ids.length} match(s) ? L'ELO sera reversé.`))) return;
    setError('');
    for (const id of ids) await api.adminDeleteMatch(id).catch((e) => setError(String(e)));
    clear();
    load();
  }

  return (
    <div className="p-4">
      {confirmNode}
      <div className="mb-3 flex items-center gap-3">
        <Input value={filter} onChange={setFilter} placeholder="Filtrer par login…" className="w-64" />
        <span className="text-zinc-500 text-xs font-mono">{filtered.length} affiché{filtered.length > 1 ? 's' : ''} / {matches.length} total</span>
      </div>
      <SudoBar
        sudo={sudo}
        onToggle={toggleSudo}
        selectedCount={selected.size}
        onBulkDelete={bulkDelete}
        bulkLabel="Supprimer les matchs"
      />
      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-2 w-8">
                  {filtered.length > 0 && (
                    <Check
                      checked={filtered.every((m) => selected.has(m.id))}
                      onChange={() => toggleAll(filtered.map((m) => m.id))}
                    />
                  )}
                </th>
                <th className="text-left py-2 px-2">Date</th>
                <th className="text-left py-2 px-2">Joueur A</th>
                <th className="text-center py-2 px-2">Score</th>
                <th className="text-left py-2 px-2">Joueur B</th>
                <th className="text-right py-2 px-2">ΔA</th>
                <th className="text-right py-2 px-2">ΔB</th>
                <th className="text-center py-2 px-2">ELO</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className={`border-b border-zinc-800/40 hover:bg-zinc-900/50 transition-colors ${selected.has(m.id) ? 'bg-red-500/5' : ''}`}>
                  <td className="py-1.5 px-2">
                    <Check checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  </td>
                  <td className="py-1.5 px-2 text-zinc-500">{fmtDate(m.playedAt)}</td>
                  <td className={`py-1.5 px-2 ${m.winner === 'A' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {editId === m.id ? <Input value={editPlayerA} onChange={setEditPlayerA} className="w-28" /> : m.playerALogin}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {editId === m.id ? (
                      <span className="flex items-center gap-1 justify-center">
                        <input
                          type="number"
                          value={editA}
                          onChange={(e) => setEditA(e.target.value)}
                          className="w-10 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-center text-zinc-100 font-mono text-xs focus:outline-none"
                        />
                        <span className="text-zinc-500">–</span>
                        <input
                          type="number"
                          value={editB}
                          onChange={(e) => setEditB(e.target.value)}
                          className="w-10 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-center text-zinc-100 font-mono text-xs focus:outline-none"
                        />
                      </span>
                    ) : (
                      <span className="tabular-nums text-zinc-100">{m.scoreA}–{m.scoreB}</span>
                    )}
                  </td>
                  <td className={`py-1.5 px-2 ${m.winner === 'B' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {editId === m.id ? <Input value={editPlayerB} onChange={setEditPlayerB} className="w-28" /> : m.playerBLogin}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${m.deltaA >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.deltaA > 0 ? '+' : ''}{m.deltaA}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${m.deltaB >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.deltaB > 0 ? '+' : ''}{m.deltaB}</td>
                  <td className="py-1.5 px-2 text-center">{m.countedForElo ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      {editId === m.id ? (
                        <>
                          <Btn onClick={() => saveEdit(m.id)} disabled={pending === m.id} variant="success">Sauver</Btn>
                          <Btn onClick={() => setEditId(null)} variant="ghost">✕</Btn>
                        </>
                      ) : (
                        <>
                          <Btn onClick={() => startEdit(m)} variant="ghost">✏️</Btn>
                          <Btn onClick={() => deleteMatch(m.id)} disabled={pending === m.id} variant="danger">🗑️</Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: IDÉES ─────────────────────────────────────────────────────────────

function IdeasTab() {
  const [ideas, setIdeas] = useState<FeatureRequestWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.featureRequests()
      .then(setIdeas)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = filter === 'all' ? ideas : ideas.filter((i) => i.status === filter);

  async function setStatus(id: string, status: 'pending' | 'accepted' | 'rejected') {
    setPending(id);
    setError('');
    try {
      await api.setFeatureRequestStatus(id, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setPending(null); }
  }

  const counts = {
    pending: ideas.filter((i) => i.status === 'pending').length,
    accepted: ideas.filter((i) => i.status === 'accepted').length,
    rejected: ideas.filter((i) => i.status === 'rejected').length,
  };

  return (
    <div className="p-4">
      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-4">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-mono px-3 py-1.5 rounded transition-colors cursor-pointer ${filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {f === 'all' ? `TOUT (${ideas.length})` : f === 'pending' ? `EN ATTENTE (${counts.pending})` : f === 'accepted' ? `ACCEPTÉES (${counts.accepted})` : `REJETÉES (${counts.rejected})`}
          </button>
        ))}
      </div>
      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucune idée dans cette catégorie.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((idea) => (
            <div key={idea.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-zinc-400">{idea.author.login}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-xs font-mono text-zinc-500">{fmtDate(idea.createdAt)}</span>
                    <FRStatusBadge status={idea.status} />
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{idea.text}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {idea.status !== 'accepted' && (
                    <Btn onClick={() => setStatus(idea.id, 'accepted')} disabled={pending === idea.id} variant="success">Accepter</Btn>
                  )}
                  {idea.status !== 'rejected' && (
                    <Btn onClick={() => setStatus(idea.id, 'rejected')} disabled={pending === idea.id} variant="danger">Rejeter</Btn>
                  )}
                  {idea.status !== 'pending' && (
                    <Btn onClick={() => setStatus(idea.id, 'pending')} disabled={pending === idea.id} variant="ghost">En attente</Btn>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: BUGS ──────────────────────────────────────────────────────────────

function BugsTab() {
  const [bugs, setBugs] = useState<BugReportWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'closed'>('all');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.bugReports()
      .then(setBugs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = filter === 'all' ? bugs : bugs.filter((b) => b.status === filter);

  async function setStatus(id: string, status: 'open' | 'resolved' | 'closed') {
    setPending(id);
    setError('');
    try {
      await api.setBugReportStatus(id, status);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally { setPending(null); }
  }

  const counts = {
    open: bugs.filter((b) => b.status === 'open').length,
    resolved: bugs.filter((b) => b.status === 'resolved').length,
    closed: bugs.filter((b) => b.status === 'closed').length,
  };

  return (
    <div className="p-4">
      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-4">
        {(['all', 'open', 'resolved', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-mono px-3 py-1.5 rounded transition-colors cursor-pointer ${filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {f === 'all' ? `TOUT (${bugs.length})` : f === 'open' ? `OUVERTS (${counts.open})` : f === 'resolved' ? `RÉSOLUS (${counts.resolved})` : `FERMÉS (${counts.closed})`}
          </button>
        ))}
      </div>
      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucun bug dans cette catégorie.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bug) => (
            <div key={bug.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-zinc-400">{bug.author.login}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-xs font-mono text-zinc-500">{fmtDate(bug.createdAt)}</span>
                    <BugStatusBadge status={bug.status} />
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed">{bug.text}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {bug.status !== 'resolved' && (
                    <Btn onClick={() => setStatus(bug.id, 'resolved')} disabled={pending === bug.id} variant="success">Résolu</Btn>
                  )}
                  {bug.status !== 'closed' && (
                    <Btn onClick={() => setStatus(bug.id, 'closed')} disabled={pending === bug.id} variant="ghost">Fermer</Btn>
                  )}
                  {bug.status !== 'open' && (
                    <Btn onClick={() => setStatus(bug.id, 'open')} disabled={pending === bug.id} variant="warn">Rouvrir</Btn>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: ALERTES ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: SuspiciousFlag['severity'] }) {
  if (severity === 'high')
    return <span className="px-1.5 py-0.5 text-xs bg-red-400/15 text-red-400 rounded font-mono">ÉLEVÉ</span>;
  if (severity === 'medium')
    return <span className="px-1.5 py-0.5 text-xs bg-orange-400/15 text-orange-400 rounded font-mono">MOYEN</span>;
  return <span className="px-1.5 py-0.5 text-xs bg-yellow-400/15 text-yellow-400 rounded font-mono">FAIBLE</span>;
}

const FLAG_TYPE_LABEL: Record<SuspiciousFlag['type'], string> = {
  pair_domination: 'Domination paire',
  recent_farming: 'Farm récent',
  elo_spike: 'Spike ELO',
  victim_pattern: 'Victime ciblée',
};

const FLAG_TYPE_ICON: Record<SuspiciousFlag['type'], string> = {
  pair_domination: '⚖️',
  recent_farming: '🔄',
  elo_spike: '📈',
  victim_pattern: '🎯',
};

function AlertesTab() {
  const [flags, setFlags] = useState<SuspiciousFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<SuspiciousFlag['type'] | 'all'>('all');
  const [inspectLogin, setInspectLogin] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.adminSuspicious()
      .then(setFlags)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  const filtered = filterType === 'all' ? flags : flags.filter((f) => f.type === filterType);

  const counts = {
    high: flags.filter((f) => f.severity === 'high').length,
    medium: flags.filter((f) => f.severity === 'medium').length,
    low: flags.filter((f) => f.severity === 'low').length,
  };

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="mb-5 grid grid-cols-3 gap-3 max-w-md">
        {[
          { label: 'Élevé', count: counts.high, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
          { label: 'Moyen', count: counts.medium, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
          { label: 'Faible', count: counts.low, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`border rounded-lg p-3 text-center ${bg}`}>
            <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{count}</div>
            <div className="text-xs text-zinc-500 uppercase mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'pair_domination', 'recent_farming', 'elo_spike', 'victim_pattern'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`text-xs font-mono px-3 py-1.5 rounded transition-colors cursor-pointer ${filterType === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t === 'all' ? `TOUT (${flags.length})` : `${FLAG_TYPE_ICON[t]} ${FLAG_TYPE_LABEL[t]}`}
          </button>
        ))}
      </div>

      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}

      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Analyse en cours…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <div className="text-zinc-500 font-mono text-sm">Aucun comportement suspect détecté.</div>
          <div className="text-zinc-600 font-mono text-xs mt-1">La communauté joue clean 👍</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((flag, i) => (
            <div
              key={i}
              className={`bg-zinc-900 border rounded-lg p-4 transition-colors ${
                flag.severity === 'high'
                  ? 'border-red-400/30 hover:border-red-400/50'
                  : flag.severity === 'medium'
                  ? 'border-orange-400/20 hover:border-orange-400/40'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-base">{FLAG_TYPE_ICON[flag.type]}</span>
                    <span className="text-xs font-mono text-zinc-300 font-medium">{FLAG_TYPE_LABEL[flag.type]}</span>
                    <SeverityBadge severity={flag.severity} />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {flag.players.map((p) => (
                        <button
                          key={p}
                          onClick={() => setInspectLogin(p === inspectLogin ? null : p)}
                          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer ${
                            inspectLogin === p
                              ? 'bg-blue-500/30 text-blue-300 border border-blue-400/40'
                              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{flag.detail}</p>
                  {(flag.matchCount !== undefined || flag.winRate !== undefined || flag.eloGain !== undefined) && (
                    <div className="mt-2 flex items-center gap-4 text-xs font-mono text-zinc-500">
                      {flag.matchCount !== undefined && <span>Matchs : <span className="text-zinc-300">{flag.matchCount}</span></span>}
                      {flag.winRate !== undefined && <span>Win rate : <span className="text-zinc-300">{Math.round(flag.winRate * 100)}%</span></span>}
                      {flag.eloGain !== undefined && <span>Gain ELO : <span className="text-emerald-400">+{flag.eloGain}</span></span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Inline moderation panel */}
              {inspectLogin && flag.players.includes(inspectLogin) && (
                <InlineModeration login={inspectLogin} onClose={() => setInspectLogin(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineModeration({ login, onClose }: { login: string; onClose: () => void }) {
  const [stats, setStats] = useState<import('../lib/api').ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.adminModerationStats(login)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [login]);

  return (
    <div className="mt-4 border-t border-zinc-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-zinc-400">Vue rapide — <span className="text-zinc-200">{login}</span></span>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs font-mono cursor-pointer">✕ fermer</button>
      </div>
      {loading ? (
        <div className="text-zinc-600 text-xs font-mono">Chargement…</div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <div className="text-zinc-500 uppercase tracking-wider mb-1.5">Stats</div>
            <div className="space-y-1 text-zinc-300">
              <div>ELO : <span className="text-zinc-100 font-bold">{stats.user.elo}</span></div>
              <div>Matches : {stats.user.matchesPlayed}</div>
              <div>Win rate : <span className="text-zinc-100">{stats.recentMatches.length > 0 ? Math.round(stats.recentMatches.filter(m => (m.playerALogin === login && m.winner === 'A') || (m.playerBLogin === login && m.winner === 'B')).length / stats.recentMatches.length * 100) : 0}%</span></div>
              <div>Rejets émis : <span className="text-orange-400">{stats.rejectionsEmitted.length}</span></div>
              <div>Rejets reçus : <span className="text-red-400">{stats.rejectionsReceived.length}</span></div>
            </div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase tracking-wider mb-1.5">Top adversaires</div>
            <div className="space-y-1">
              {stats.topOpponents.slice(0, 5).map(({ login: opp, count }) => (
                <div key={opp} className="flex items-center justify-between">
                  <span className="text-zinc-300">{opp}</span>
                  <span className="text-zinc-500">{count}x</span>
                </div>
              ))}
              {stats.topOpponents.length === 0 && <div className="text-zinc-600">Aucun</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-zinc-600 text-xs font-mono">Erreur de chargement.</div>
      )}
    </div>
  );
}

// ── Tab: AUDIT ─────────────────────────────────────────────────────────────

const AUDIT_ACTIONS: AdminAuditAction[] = [
  'SET_ROLE', 'BAN_USER', 'UNBAN_USER', 'EDIT_STATS', 'EDIT_TITLE', 'DELETE_MATCH', 'EDIT_MATCH', 'REFRESH_IMAGES', 'RESET_DATABASE',
  'DELETE_CHALLENGE', 'DELETE_PENDING_MATCH', 'DELETE_REJECTED_MATCH', 'DELETE_OPS',
];

const ACTION_COLOR: Record<AdminAuditAction, string> = {
  SET_ROLE: 'text-amber-400',
  BAN_USER: 'text-red-400',
  UNBAN_USER: 'text-emerald-400',
  EDIT_STATS: 'text-blue-400',
  EDIT_TITLE: 'text-purple-400',
  DELETE_MATCH: 'text-red-400',
  EDIT_MATCH: 'text-blue-400',
  REFRESH_IMAGES: 'text-zinc-400',
  RESET_DATABASE: 'text-red-500',
  DELETE_CHALLENGE: 'text-red-400',
  DELETE_PENDING_MATCH: 'text-red-400',
  DELETE_REJECTED_MATCH: 'text-red-400',
  DELETE_OPS: 'text-red-400',
  DELETE_TOURNAMENT: 'text-red-400',
};

function AuditTab() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<AdminAuditAction | 'all'>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const list = await api.adminAuditLog({
        actor: actorFilter || undefined,
        target: targetFilter || undefined,
        action: actionFilter === 'all' ? undefined : actionFilter,
        limit: 200,
      });
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [actorFilter, targetFilter, actionFilter]);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={actorFilter} onChange={setActorFilter} placeholder="Filtre acteur…" className="w-44" />
        <Input value={targetFilter} onChange={setTargetFilter} placeholder="Filtre cible…" className="w-44" />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as AdminAuditAction | 'all')}
          className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono px-2 py-1.5 rounded cursor-pointer"
        >
          <option value="all">Toutes actions</option>
          {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-zinc-500 text-xs font-mono ml-auto">{entries.length} entrées</span>
      </div>
      {error && <div className="mb-3 text-xs text-red-400 font-mono">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-xs font-mono">Chargement…</div>
      ) : entries.length === 0 ? (
        <div className="text-zinc-500 text-xs font-mono">Aucune entrée.</div>
      ) : (
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
              <th className="text-left py-1.5 px-2">Date</th>
              <th className="text-left py-1.5 px-2">Acteur</th>
              <th className="text-left py-1.5 px-2">Rôle</th>
              <th className="text-left py-1.5 px-2">Action</th>
              <th className="text-left py-1.5 px-2">Cible</th>
              <th className="text-left py-1.5 px-2">Détails</th>
              <th className="text-left py-1.5 px-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/30">
                <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('fr-FR')}
                </td>
                <td className="py-2 px-2 text-zinc-200 font-medium">{e.actorLogin}</td>
                <td className="py-2 px-2"><RoleBadge role={e.actorRole} /></td>
                <td className={`py-2 px-2 font-bold ${ACTION_COLOR[e.action] ?? 'text-zinc-300'}`}>{e.action}</td>
                <td className="py-2 px-2 text-zinc-300">{e.targetLogin ?? '—'}</td>
                <td className="py-2 px-2 text-zinc-500 max-w-[400px]">
                  {e.payload ? (
                    <code className="text-[10px] text-zinc-400 break-all">
                      {JSON.stringify(e.payload).slice(0, 200)}
                    </code>
                  ) : '—'}
                </td>
                <td className="py-2 px-2 text-zinc-600 text-[10px]">{e.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab: ALL HISTORY ──────────────────────────────────────────────────────

const EVENT_TYPE_LABEL: Record<AllHistoryEventType, string> = {
  challenge: 'Défi',
  pending_match: 'Décl. partie',
  played_match: 'Match joué',
  rejected_match: 'Décl. refusée',
  ops: 'OPS',
};

const EVENT_TYPE_COLOR: Record<AllHistoryEventType, string> = {
  challenge: 'text-blue-400 bg-blue-400/10',
  pending_match: 'text-yellow-400 bg-yellow-400/10',
  played_match: 'text-emerald-400 bg-emerald-400/10',
  rejected_match: 'text-red-400 bg-red-400/10',
  ops: 'text-orange-400 bg-orange-400/10',
};

const EVENT_TYPE_ICON: Record<AllHistoryEventType, string> = {
  challenge: '⚔️',
  pending_match: '⏳',
  played_match: '✅',
  rejected_match: '✗',
  ops: '🎯',
};

const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  declined: 'Refusé',
  recorded: 'Enregistré',
  cancelled: 'Annulé',
};

const CHALLENGE_STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-400',
  accepted: 'text-emerald-400',
  declined: 'text-red-400',
  recorded: 'text-blue-400',
  cancelled: 'text-zinc-500',
};

function EventDetail({ ev }: { ev: AllHistoryEvent }) {
  if (ev.type === 'challenge') {
    return (
      <span className="flex items-center gap-2 flex-wrap">
        <span className={`font-mono text-xs ${CHALLENGE_STATUS_COLOR[ev.status ?? ''] ?? 'text-zinc-400'}`}>
          {CHALLENGE_STATUS_LABEL[ev.status ?? ''] ?? ev.status}
        </span>
        {ev.scheduledAt && (
          <span className="text-zinc-600 text-xs">
            prévu {new Date(ev.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
        )}
      </span>
    );
  }
  if (ev.type === 'pending_match') {
    return (
      <span className="text-zinc-400 text-xs tabular-nums">
        score déclaré : {ev.scoreA}–{ev.scoreB}
      </span>
    );
  }
  if (ev.type === 'played_match') {
    return (
      <span className="flex items-center gap-2">
        <span className="tabular-nums text-zinc-100 font-mono text-xs">{ev.scoreA}–{ev.scoreB}</span>
        {ev.winner && (
          <span className="text-emerald-400 text-xs">
            → {ev.winner === 'A' ? ev.playerA : ev.playerB} gagne
          </span>
        )}
        {typeof ev.deltaA === 'number' && (
          <span className="text-zinc-500 text-xs tabular-nums">
            ({ev.deltaA > 0 ? '+' : ''}{ev.deltaA} / {ev.deltaB! > 0 ? '+' : ''}{ev.deltaB})
          </span>
        )}
        {!ev.countedForElo && <span className="text-zinc-600 text-xs">hors ELO</span>}
      </span>
    );
  }
  if (ev.type === 'rejected_match') {
    return (
      <span className="flex items-center gap-2 flex-wrap">
        <span className="text-xs tabular-nums text-zinc-400">{ev.scoreA}–{ev.scoreB}</span>
        <span className={`text-xs px-1 py-0.5 rounded ${ev.contestReason === 'never_played' ? 'bg-red-400/15 text-red-400' : 'bg-orange-400/15 text-orange-400'}`}>
          {ev.contestReason === 'never_played' ? 'Jamais joué' : 'Score incorrect'}
        </span>
        {ev.contestMessage && <span className="text-zinc-500 text-xs truncate max-w-xs" title={ev.contestMessage}>{ev.contestMessage}</span>}
      </span>
    );
  }
  if (ev.type === 'ops') {
    return (
      <span className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400">{ev.forcedUsed}/3 matchs forcés</span>
        {ev.expiresAt && (
          <span className="text-zinc-600">expire {new Date(ev.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
        )}
      </span>
    );
  }
  return null;
}

// Modération inline rapide (ban/unban) depuis l'historique
function QuickBanButton({ login, onDone }: { login: string; onDone: () => void }) {
  const [userData, setUserData] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.adminUsers().then((list) => {
      setUserData(list.find((u) => u.login === login) ?? null);
    }).finally(() => setLoading(false));
  }, [login]);

  if (loading) return <span className="text-zinc-600 text-xs font-mono">…</span>;
  if (!userData) return null;

  async function toggle() {
    if (!userData) return;
    setPending(true);
    try {
      if (userData.bannedAt) await api.adminUnbanUser(userData.login);
      else await api.adminBanUser(userData.login);
      onDone();
    } finally { setPending(false); }
  }

  return (
    <Btn onClick={toggle} disabled={pending} variant={userData.bannedAt ? 'success' : 'danger'}>
      {userData.bannedAt ? 'Unban' : 'Ban'}
    </Btn>
  );
}

// Ligne expandée avec actions complètes
function HistoryRowActions({
  ev,
  onDelete,
  onEditSaved,
}: {
  ev: AllHistoryEvent;
  onDelete: () => void;
  onEditSaved: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editA, setEditA] = useState(String(ev.scoreA ?? ''));
  const [editB, setEditB] = useState(String(ev.scoreB ?? ''));
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState('');
  const [showModo, setShowModo] = useState(false);

  async function handleDelete() {
    const label = EVENT_TYPE_LABEL[ev.type];
    if (!confirm(`Supprimer ce ${label} ? Cette action est irréversible.`)) return;
    setPending(true);
    setErr('');
    try {
      if (ev.type === 'played_match') await api.adminDeleteMatch(ev.id);
      else if (ev.type === 'pending_match') await api.adminDeletePendingMatch(ev.id);
      else if (ev.type === 'rejected_match') await api.adminDeleteRejectedMatch(ev.id);
      else if (ev.type === 'challenge') await api.adminDeleteChallenge(ev.id);
      else if (ev.type === 'ops') await api.adminDeleteOps(ev.id);
      onDelete();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); }
    finally { setPending(false); }
  }

  async function handleEdit() {
    setPending(true);
    setErr('');
    try {
      await api.adminEditMatch(ev.id, {
        scoreA: Number(editA),
        scoreB: Number(editB),
        playerALogin: ev.playerA,
        playerBLogin: ev.playerB,
      });
      setEditMode(false);
      onEditSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); }
    finally { setPending(false); }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {err && <span className="text-red-400 text-xs">{err}</span>}

      {/* Edit score — uniquement pour played_match */}
      {ev.type === 'played_match' && (
        editMode ? (
          <>
            <input
              type="number"
              value={editA}
              onChange={(e) => setEditA(e.target.value)}
              className="w-10 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-center text-zinc-100 font-mono text-xs focus:outline-none"
            />
            <span className="text-zinc-500 text-xs">–</span>
            <input
              type="number"
              value={editB}
              onChange={(e) => setEditB(e.target.value)}
              className="w-10 bg-zinc-700 border border-zinc-600 rounded px-1 py-0.5 text-center text-zinc-100 font-mono text-xs focus:outline-none"
            />
            <Btn onClick={handleEdit} disabled={pending} variant="success">✓</Btn>
            <Btn onClick={() => setEditMode(false)} variant="ghost">✕</Btn>
          </>
        ) : (
          <Btn onClick={() => { setEditMode(true); setEditA(String(ev.scoreA ?? 0)); setEditB(String(ev.scoreB ?? 0)); }} variant="ghost">✏️</Btn>
        )
      )}

      {/* Modération joueurs */}
      <Btn onClick={() => setShowModo((v) => !v)} variant="ghost" className={showModo ? 'text-blue-400' : ''}>
        👤
      </Btn>

      {/* Supprimer */}
      {!editMode && (
        <Btn onClick={handleDelete} disabled={pending} variant="danger">🗑️</Btn>
      )}

      {/* Panel modo inline */}
      {showModo && (
        <div className="w-full mt-2 pt-2 border-t border-zinc-800 flex flex-wrap gap-3 items-center">
          <span className="text-zinc-500 text-xs font-mono">Modération :</span>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-300 text-xs font-mono">{ev.playerA}</span>
            <QuickBanButton login={ev.playerA} onDone={() => setShowModo(false)} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-300 text-xs font-mono">{ev.playerB}</span>
            <QuickBanButton login={ev.playerB} onDone={() => setShowModo(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function AllHistoryTab() {
  const [events, setEvents] = useState<AllHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginFilter, setLoginFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<AllHistoryEventType | 'all'>('all');
  const [gameFilter, setGameFilter] = useState<'all' | 'babyfoot' | 'smash' | 'chess'>('all');
  const [sudo, setSudo] = useState(false);
  const { requestConfirm, confirmNode } = useConfirmDialog();
  const { selected, toggle, toggleAll, clear } = useSelection();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.adminAllHistory({
      login: loginFilter.trim() || undefined,
      type: typeFilter === 'all' ? undefined : typeFilter,
      game: gameFilter === 'all' ? undefined : gameFilter,
      limit: 500,
    })
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, [loginFilter, typeFilter, gameFilter]);

  useEffect(() => { load(); }, [load]);

  const typeOrder: AllHistoryEventType[] = ['challenge', 'pending_match', 'played_match', 'rejected_match', 'ops'];

  function removeEvent(id: string, type: AllHistoryEventType) {
    setEvents((prev) => prev.filter((e) => !(e.id === id && e.type === type)));
  }

  const keyOf = (ev: AllHistoryEvent) => `${ev.type}-${ev.id}`;
  function deleteEvent(ev: AllHistoryEvent): Promise<unknown> {
    switch (ev.type) {
      case 'played_match': return api.adminDeleteMatch(ev.id);
      case 'pending_match': return api.adminDeletePendingMatch(ev.id);
      case 'rejected_match': return api.adminDeleteRejectedMatch(ev.id);
      case 'challenge': return api.adminDeleteChallenge(ev.id);
      case 'ops': return api.adminDeleteOps(ev.id);
    }
  }
  async function toggleSudo() {
    if (sudo) { setSudo(false); return; }
    const ok = await requestConfirm(
      'Activer le mode SUDO ?\nLes suppressions ne demanderont plus de confirmation.',
      { danger: true, confirmLabel: 'Activer sudo' },
    );
    if (ok) setSudo(true);
  }
  async function bulkDelete() {
    const picked = events.filter((e) => selected.has(keyOf(e)));
    if (picked.length === 0) return;
    if (!sudo) {
      const ok = await requestConfirm(`Supprimer ${picked.length} événement(s) ? Irréversible.`, {
        danger: true,
        confirmLabel: 'Supprimer',
      });
      if (!ok) return;
    }
    for (const ev of picked) {
      await deleteEvent(ev).catch(() => {});
      removeEvent(ev.id, ev.type);
    }
    clear();
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={loginFilter} onChange={setLoginFilter} placeholder="Filtrer par login…" className="w-56" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AllHistoryEventType | 'all')}
          className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-mono px-2 py-1.5 rounded cursor-pointer"
        >
          <option value="all">Tous les types</option>
          {typeOrder.map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_ICON[t]} {EVENT_TYPE_LABEL[t]}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {(['all', 'babyfoot', 'smash', 'chess'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGameFilter(g)}
              className={`px-2.5 py-1.5 rounded font-mono text-xs border transition-colors ${
                gameFilter === g
                  ? 'bg-zinc-100/10 border-zinc-400 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {g === 'all' ? 'Tous jeux' : TOURN_GAME_LABEL[g]}
            </button>
          ))}
        </div>
        <Btn onClick={load} variant="default">Actualiser</Btn>
        <span className="text-zinc-500 text-xs font-mono ml-auto">{events.length} événements</span>
      </div>

      {/* Type pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {typeOrder.map((t) => {
          const count = events.filter((e) => e.type === t).length;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer border ${
                typeFilter === t
                  ? EVENT_TYPE_COLOR[t] + ' border-current/40'
                  : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
              }`}
            >
              {EVENT_TYPE_ICON[t]} {EVENT_TYPE_LABEL[t]} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {confirmNode}
      <SudoBar
        sudo={sudo}
        onToggle={toggleSudo}
        selectedCount={selected.size}
        onBulkDelete={bulkDelete}
        bulkLabel="Supprimer les événements"
      />

      {error && <div className="text-xs text-red-400 font-mono mb-3">{error}</div>}

      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : events.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucun événement trouvé.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                <th className="py-1.5 px-2 w-8">
                  {events.length > 0 && (
                    <Check
                      checked={events.every((e) => selected.has(keyOf(e)))}
                      onChange={() => toggleAll(events.map(keyOf))}
                    />
                  )}
                </th>
                <th className="text-left py-1.5 px-2">Date</th>
                <th className="text-left py-1.5 px-2">Type</th>
                <th className="text-left py-1.5 px-2">Joueur A</th>
                <th className="text-left py-1.5 px-2">Joueur B</th>
                <th className="text-left py-1.5 px-2">Détail</th>
                <th className="text-right py-1.5 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={`${ev.type}-${ev.id}`} className={`border-b border-zinc-800/40 hover:bg-zinc-900/30 transition-colors ${selected.has(keyOf(ev)) ? 'bg-red-500/5' : ''}`}>
                  <td className="py-2 px-2 align-top">
                    <Check checked={selected.has(keyOf(ev))} onChange={() => toggle(keyOf(ev))} />
                  </td>
                  <td className="py-2 px-2 text-zinc-500 whitespace-nowrap align-top">{fmtDate(ev.at)}</td>
                  <td className="py-2 px-2 align-top">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${EVENT_TYPE_COLOR[ev.type]}`}>
                      {EVENT_TYPE_ICON[ev.type]} {EVENT_TYPE_LABEL[ev.type]}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-zinc-200 align-top">{ev.playerA}</td>
                  <td className="py-2 px-2 text-zinc-400 align-top">{ev.playerB}</td>
                  <td className="py-2 px-2 align-top"><EventDetail ev={ev} /></td>
                  <td className="py-2 px-2 align-top">
                    <HistoryRowActions
                      ev={ev}
                      onDelete={() => removeEvent(ev.id, ev.type)}
                      onEditSaved={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: EN ATTENTE (SUPERADMIN) ───────────────────────────────────────────

function PendingTab() {
  const [rows, setRows] = useState<PendingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [fA, setFA] = useState('');
  const [fB, setFB] = useState('');
  const [fScoreA, setFScoreA] = useState('10');
  const [fScoreB, setFScoreB] = useState('0');
  const [forcing, setForcing] = useState(false);
  const [forceMsg, setForceMsg] = useState('');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.pendingMatches()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useServerEvents(() => load(true), PANEL_EVENTS);

  async function act(id: string, fn: () => Promise<unknown>) {
    setPending(id);
    setError('');
    try { await fn(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
    finally { setPending(null); }
  }

  async function forceResult() {
    const a = fA.trim();
    const b = fB.trim();
    if (!a || !b) return;
    setForcing(true);
    setForceMsg('');
    try {
      await api.adminForceResult(a, b, Number(fScoreA), Number(fScoreB));
      setForceMsg(`✓ Résultat enregistré : ${a} ${fScoreA}–${fScoreB} ${b}`);
      setFA('');
      setFB('');
    } catch (e) {
      setForceMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setForcing(false);
    }
  }

  return (
    <div className="p-4">
      {/* Forcer un résultat directement */}
      <div className="mb-5 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <div className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-2">
          Forcer un résultat (faux comme vrais joueurs)
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Joueur A</span>
            <Input value={fA} onChange={setFA} placeholder="login A" className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Score A</span>
            <Input type="number" value={fScoreA} onChange={setFScoreA} className="w-20" />
          </div>
          <span className="text-zinc-600 pb-2">–</span>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Score B</span>
            <Input type="number" value={fScoreB} onChange={setFScoreB} className="w-20" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">Joueur B</span>
            <Input value={fB} onChange={setFB} placeholder="login B" className="w-36" />
          </div>
          <Btn onClick={forceResult} disabled={forcing || !fA.trim() || !fB.trim()} variant="success">
            {forcing ? 'Enregistrement…' : 'Forcer le résultat'}
          </Btn>
        </div>
        {forceMsg && <div className="mt-2 text-xs font-mono text-zinc-300">{forceMsg}</div>}
        <div className="mt-1 text-[10px] text-zinc-600 font-mono">
          L'ELO des deux joueurs est appliqué immédiatement. Il faut un vainqueur (scores différents).
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-zinc-500 text-xs font-mono">
          {rows.length} match{rows.length !== 1 ? 's' : ''} en attente de confirmation
        </span>
        <Btn onClick={load} variant="ghost">↻ Rafraîchir</Btn>
      </div>
      {error && <div className="mb-3 text-xs text-red-400 font-mono">{error}</div>}
      {loading ? (
        <div className="text-zinc-500 text-sm font-mono">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucun match en attente.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                <th className="text-left py-2 px-2">Déclaré le</th>
                <th className="text-left py-2 px-2">Déclarant</th>
                <th className="text-center py-2 px-2">Score</th>
                <th className="text-left py-2 px-2">Opposant (doit confirmer)</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/50 transition-colors">
                  <td className="py-1.5 px-2 text-zinc-500 whitespace-nowrap">{fmtDate(p.declaredAt)}</td>
                  <td className="py-1.5 px-2 text-zinc-200">{p.declarerLogin}</td>
                  <td className="py-1.5 px-2 text-center tabular-nums text-zinc-100">{p.scoreDeclarer}–{p.scoreOpponent}</td>
                  <td className="py-1.5 px-2 text-zinc-300">{p.opponentLogin}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Btn
                        onClick={() => {
                          if (confirm(`Forcer la validation du score ${p.scoreDeclarer}–${p.scoreOpponent} (${p.declarerLogin} vs ${p.opponentLogin}) ? L'ELO s'appliquera immédiatement.`)) {
                            act(p.id, () => api.adminForceConfirmMatch(p.id));
                          }
                        }}
                        disabled={pending === p.id}
                        variant="success"
                      >
                        Forcer ✓
                      </Btn>
                      <Btn
                        onClick={() => {
                          if (confirm('Annuler ce match en attente ? Aucun ELO ne bougera, le match est supprimé.')) {
                            act(p.id, () => api.adminForceCancelMatch(p.id));
                          }
                        }}
                        disabled={pending === p.id}
                        variant="danger"
                      >
                        Annuler
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

// `pending` (force-valider/annuler) est réservé au SUPERADMIN → filtré à l'affichage.
// ── Saisons (SUPERADMIN) ────────────────────────────────────────────────────
const CLOSE_CONFIRM_PHRASE = 'cloturer la saison';

function CloseSeasonModal({
  season,
  onClose,
  onDone,
}: {
  season: Season;
  onClose: () => void;
  onDone: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ champion: string | null; players: number } | null>(null);
  const ok = typed.trim() === CLOSE_CONFIRM_PHRASE;

  async function handleClose() {
    setBusy(true);
    try {
      const r = await api.closeSeason();
      setResult({ champion: r.champion, players: r.players });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 border border-red-500/40 rounded-lg w-full max-w-md p-5 font-mono" onClick={(e) => e.stopPropagation()}>
        {result ? (
          <div className="space-y-3 text-sm text-zinc-200">
            <div className="text-emerald-400 font-bold">Saison clôturée ✓</div>
            <div>{result.players} joueur·s remis à zéro (ELO 1000).</div>
            {result.champion && <div>🏆 Champion : <span className="text-yellow-400 font-bold">{result.champion}</span></div>}
            <Btn variant="default" onClick={() => { onDone(); onClose(); }} className="mt-2">Fermer</Btn>
          </div>
        ) : (
          <>
            <div className="text-sm font-bold text-red-400 uppercase tracking-widest mb-2">Clôturer « {season.name} »</div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Snapshot du classement final + badge champion, puis <span className="text-red-400 font-bold">reset ELO 1000 pour tous</span>.
              L'historique des matchs est conservé (taggé saison). <span className="text-red-400">Irréversible.</span>
            </p>
            <p className="text-[11px] text-zinc-500 mb-1">Recopie pour confirmer :</p>
            <div className="text-yellow-400 text-xs mb-2 select-none">{CLOSE_CONFIRM_PHRASE}</div>
            <Input value={typed} onChange={setTyped} placeholder={CLOSE_CONFIRM_PHRASE} className="w-full mb-3" />
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" onClick={onClose}>Annuler</Btn>
              <Btn variant="danger" onClick={handleClose} disabled={!ok || busy}>
                {busy ? 'Clôture…' : 'Clôturer la saison'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Classements figés d'une saison, par discipline (granularité par mode).
function SeasonStandingsBlock({ seasonId }: { seasonId: string }) {
  const [game, setGame] = useState<'babyfoot' | 'smash' | 'chess'>('babyfoot');
  const [rows, setRows] = useState<import('../lib/api').SeasonStanding[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    api.seasonStandings(seasonId, game).then((r) => alive && setRows(r)).catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [seasonId, game]);

  return (
    <div className="border-t border-zinc-800 px-3 py-2.5">
      <div className="flex gap-1 mb-2">
        {(['babyfoot', 'smash', 'chess'] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGame(g)}
            className={`px-2 py-1 rounded font-mono text-[11px] border transition-colors ${
              game === g ? 'bg-zinc-100/10 border-zinc-400 text-zinc-100' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {TOURN_GAME_LABEL[g]}
          </button>
        ))}
      </div>
      {rows === null ? (
        <div className="text-zinc-600 text-xs font-mono">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="text-zinc-600 text-xs font-mono">Aucun classement figé pour ce mode.</div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 font-mono uppercase tracking-wider">
              <th className="text-left py-1 px-2">#</th>
              <th className="text-left py-1 px-2">Joueur</th>
              <th className="text-right py-1 px-2">ELO</th>
              <th className="text-right py-1 px-2">V-D</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.login} className="border-t border-zinc-800/50">
                <td className="py-1 px-2 tabular-nums text-zinc-400">{r.rank}</td>
                <td className="py-1 px-2 text-zinc-200">{r.login}</td>
                <td className="py-1 px-2 text-right tabular-nums text-zinc-100">{r.elo}</td>
                <td className="py-1 px-2 text-right tabular-nums text-zinc-500">{r.wins}-{r.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SeasonsTab() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [closing, setClosing] = useState(false);
  const [openSeason, setOpenSeason] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSeasons(await api.seasons());
    } catch {
      /* noop */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const active = seasons.find((s) => s.isActive) ?? null;

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setMsg('');
    try {
      await api.createSeason(n);
      setName('');
      setMsg('Saison créée ✓');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      {closing && active && (
        <CloseSeasonModal season={active} onClose={() => setClosing(false)} onDone={load} />
      )}

      <Section title="Saison en cours">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-800/50 border border-zinc-700 rounded p-3">
            <div className="text-sm text-zinc-200">
              <span className="text-emerald-400 font-bold">{active.name}</span>
              <span className="text-zinc-500 text-xs ml-2">depuis {fmtDate(active.startedAt)}</span>
            </div>
            <Btn variant="danger" onClick={() => setClosing(true)}>Clôturer la saison en cours</Btn>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Aucune saison active.</div>
        )}
      </Section>

      <Section title="Créer une nouvelle saison">
        {active ? (
          <div className="text-xs text-zinc-500">Clôture d'abord la saison en cours.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input value={name} onChange={setName} placeholder="Nom (ex. Saison 2)" className="flex-1 min-w-[180px]" />
            <Btn variant="success" onClick={create} disabled={busy || !name.trim()}>
              {busy ? 'Création…' : 'Créer la saison'}
            </Btn>
          </div>
        )}
        {msg && <div className="text-xs text-zinc-400 mt-2">{msg}</div>}
      </Section>

      <Section title="Historique des saisons">
        <div className="space-y-1.5">
          {seasons.map((s) => (
            <div key={s.id} className="bg-zinc-800/30 border border-zinc-800 rounded">
              <button
                type="button"
                onClick={() => setOpenSeason(openSeason === s.id ? null : s.id)}
                className="w-full flex items-center justify-between gap-2 text-xs px-3 py-2 cursor-pointer hover:bg-zinc-800/40"
              >
                <span className="text-zinc-200 font-bold">{s.name}</span>
                <span className="flex items-center gap-2 text-zinc-500">
                  {s.isActive ? (
                    <span className="text-emerald-400">en cours</span>
                  ) : (
                    `clôturée ${s.endedAt ? fmtDate(s.endedAt) : ''}`
                  )}
                  {!s.isActive && <span className="text-zinc-600">{openSeason === s.id ? '▲' : '▼ classements'}</span>}
                </span>
              </button>
              {openSeason === s.id && !s.isActive && <SeasonStandingsBlock seasonId={s.id} />}
            </div>
          ))}
          {seasons.length === 0 && <div className="text-zinc-600 text-xs">Aucune saison.</div>}
        </div>
      </Section>
    </div>
  );
}

// ── Onglet TOURNOIS : liste complète + suppression précise ───────────────────

const TOURN_STATUS: Record<Tournament['status'], { label: string; cls: string }> = {
  registration: { label: 'INSCRIPTIONS', cls: 'bg-teal-400/15 text-teal-300' },
  in_progress: { label: 'EN COURS', cls: 'bg-amber-400/15 text-amber-400' },
  finished: { label: 'TERMINÉ', cls: 'bg-zinc-600/30 text-zinc-400' },
  cancelled: { label: 'ANNULÉ', cls: 'bg-red-400/15 text-red-400' },
};

const TOURN_GAME_LABEL: Record<string, string> = {
  babyfoot: '⚽ Babyfoot',
  smash: '🎮 Smash',
  chess: '♟️ Échecs',
};

function TournamentsTab() {
  const [rows, setRows] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [gameFilter, setGameFilter] = useState<'all' | 'babyfoot' | 'smash' | 'chess'>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Le GOD gère TOUTES les disciplines : on agrège les 3 listes (chaque endpoint
  // est filtré par jeu côté serveur).
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.tournaments('babyfoot'),
      api.tournaments('smash'),
      api.tournaments('chess'),
    ])
      .then((lists) => setRows(lists.flat()))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useServerEvents(() => load(true), [...PANEL_EVENTS, 'tournament:update']);

  async function handleDelete(t: Tournament) {
    if (
      !confirm(
        `Supprimer le tournoi « ${t.name} » (${t.kind}, ${TOURN_STATUS[t.status].label}) ?\n` +
          `Cette action est irréversible — entries et matchs seront effacés.`,
      )
    )
      return;
    setBusyId(t.id);
    setError('');
    try {
      await api.adminDeleteTournament(t.id);
      load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const filtered = rows.filter(
    (t) =>
      (gameFilter === 'all' || (t.game ?? 'babyfoot') === gameFilter) &&
      (t.name.toLowerCase().includes(filter.toLowerCase()) ||
        t.createdByLogin.includes(filter) ||
        (t.winner?.login ?? '').includes(filter)),
  );

  const order: Tournament['status'][] = ['in_progress', 'registration', 'finished', 'cancelled'];
  const sorted = [...filtered].sort(
    (a, b) =>
      order.indexOf(a.status) - order.indexOf(b.status) ||
      (a.createdAt < b.createdAt ? 1 : -1),
  );

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Input value={filter} onChange={setFilter} placeholder="Filtrer (nom, organisateur, vainqueur)…" className="w-72" />
        <div className="flex gap-1">
          {(['all', 'babyfoot', 'smash', 'chess'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGameFilter(g)}
              className={`px-2.5 py-1.5 rounded font-mono text-xs border transition-colors ${
                gameFilter === g
                  ? 'bg-zinc-100/10 border-zinc-400 text-zinc-100'
                  : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {g === 'all' ? 'Tous' : TOURN_GAME_LABEL[g]}
            </button>
          ))}
        </div>
        <Btn onClick={() => load()} variant="ghost">↻ Recharger</Btn>
        <span className="text-zinc-600 text-xs font-mono">{sorted.length} tournoi(s)</span>
      </div>
      {error && <div className="text-red-400 text-xs font-mono mb-3">{error}</div>}
      {loading ? (
        <div className="text-zinc-600 text-sm font-mono">Chargement…</div>
      ) : sorted.length === 0 ? (
        <div className="text-zinc-600 text-sm font-mono">Aucun tournoi.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs font-mono uppercase tracking-wider border-b border-zinc-800">
                <th className="text-left py-2 px-3">Nom</th>
                <th className="text-left py-2 px-3">Jeu</th>
                <th className="text-left py-2 px-3">Type</th>
                <th className="text-left py-2 px-3">Format</th>
                <th className="text-center py-2 px-3">Joueurs</th>
                <th className="text-left py-2 px-3">Statut</th>
                <th className="text-left py-2 px-3">Organisateur</th>
                <th className="text-left py-2 px-3">Vainqueur</th>
                <th className="text-left py-2 px-3">Créé</th>
                <th className="text-right py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                  <td className="py-2 px-3 text-zinc-100 font-medium max-w-[200px] truncate">
                    <button
                      onClick={() => window.open(`/tournaments/${encodeURIComponent(t.id)}`, '_blank')}
                      className="hover:text-amber-400 cursor-pointer text-left truncate w-full"
                    >
                      {t.name}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-zinc-300 font-mono text-xs whitespace-nowrap">
                    {TOURN_GAME_LABEL[t.game ?? 'babyfoot']}
                  </td>
                  <td className="py-2 px-3">
                    <span className={t.kind === 'official' ? 'text-amber-400 font-mono text-xs' : 'text-zinc-400 font-mono text-xs'}>
                      {t.kind === 'official' ? '★ OFFICIEL' : 'amical'}
                      {t.isPrivate ? ' 🔒' : ''}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-zinc-400 font-mono text-xs">
                    {t.format === 'pools' ? 'poules' : 'élim.'}
                  </td>
                  <td className="py-2 px-3 text-center tabular-nums text-zinc-300">
                    {(t.entries?.length ?? 0)}/{t.capacity}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.5 text-xs rounded font-mono ${TOURN_STATUS[t.status].cls}`}>
                      {TOURN_STATUS[t.status].label}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-zinc-400 font-mono text-xs">{t.createdByLogin}</td>
                  <td className="py-2 px-3 text-zinc-300 font-mono text-xs">
                    {t.winner?.login ? `🏆 ${t.winner.login}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-zinc-500 font-mono text-xs whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                  <td className="py-2 px-3 text-right">
                    <Btn onClick={() => handleDelete(t)} disabled={busyId === t.id} variant="danger">
                      🗑️ Supprimer
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TABS: { id: Tab; label: string; superAdminOnly?: boolean }[] = [
  { id: 'users', label: 'UTILISATEURS' },
  { id: 'moderation', label: 'MODÉRATION' },
  { id: 'rejets', label: 'REJETS' },
  { id: 'matches', label: 'MATCHES' },
  { id: 'pending', label: 'EN ATTENTE', superAdminOnly: true },
  { id: 'ideas', label: 'IDÉES' },
  { id: 'bugs', label: 'BUGS' },
  { id: 'alertes', label: 'ALERTES' },
  { id: 'audit', label: 'AUDIT' },
  { id: 'history', label: 'ALL HISTORY' },
  { id: 'tournaments', label: 'TOURNOIS' },
  { id: 'seasons', label: 'SAISONS', superAdminOnly: true },
];

export function GODPage() {
  const navigate = useNavigate();
  const [myLogin, setMyLogin] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('users');

  useEffect(() => {
    api.me()
      .then((data) => {
        const role = data.role;
        if (role === 'ADMIN' || role === 'SUPERADMIN') {
          setMyLogin(data.login);
          setMyRole(role);
        } else {
          setMyRole(null);
        }
      })
      .catch(() => setMyRole(null))
      .finally(() => setAuthLoading(false));
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center overflow-hidden">
        <span className="text-zinc-500 font-mono text-sm">Vérification des droits…</span>
      </div>
    );
  }

  if (!myRole || !myLogin) {
    return (
      <div className="h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 overflow-hidden">
        <span className="text-red-400 font-mono text-2xl font-bold">403</span>
        <span className="text-zinc-400 font-mono text-sm">Accès refusé. Admins uniquement.</span>
        <button onClick={() => navigate('/challenges')} className="text-zinc-500 font-mono text-xs hover:text-zinc-300 transition-colors cursor-pointer">
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/challenges')}
              aria-label="Retour à l'application"
              className="flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <span className="text-zinc-300 font-bold tracking-widest text-sm">GOD PANEL</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400 text-xs">{myLogin}</span>
            <RoleBadge role={myRole} />
          </div>
          <button
            onClick={() => navigate('/challenges')}
            className="flex items-center gap-1 text-zinc-500 text-xs hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            Retour app
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/30">
        <div className="max-w-screen-2xl mx-auto px-4 flex items-center gap-0">
          {TABS.filter((tab) => !tab.superAdminOnly || myRole === 'SUPERADMIN').map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs tracking-widest transition-colors cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'text-zinc-100 border-zinc-400'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto">
          {activeTab === 'users' && <UsersTab myRole={myRole} myLogin={myLogin} />}
          {activeTab === 'moderation' && <ModerationTab />}
          {activeTab === 'rejets' && <RejetsTab />}
          {activeTab === 'matches' && <MatchesTab />}
          {activeTab === 'pending' && myRole === 'SUPERADMIN' && <PendingTab />}
          {activeTab === 'ideas' && <IdeasTab />}
          {activeTab === 'bugs' && <BugsTab />}
          {activeTab === 'alertes' && <AlertesTab />}
          {activeTab === 'audit' && <AuditTab />}
          {activeTab === 'history' && <AllHistoryTab />}
          {activeTab === 'tournaments' && <TournamentsTab />}
          {activeTab === 'seasons' && myRole === 'SUPERADMIN' && <SeasonsTab />}
        </div>
      </div>
    </div>
  );
}
