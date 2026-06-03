import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '../../components/Panel';
import { Button } from '../../components/Button';
import { Pills } from '../../components/Pills';
import { Trophy, Lock, X, Swords, Crown, ChevronRight, Users, Info } from 'lucide-react';
import { api, type Tournament } from '../../lib/api';
import { tournamentArt } from '../../lib/tournamentArt';
import { TournamentCup } from '../../components/TournamentCup';
import { SmashTrophy } from '../../components/SmashTrophy';
import { ChessTrophy } from '../../components/ChessTrophy';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useFlash } from '../../hooks/useFlash';

type CapacityChoice = '6' | '8' | '16' | 'custom';
const POOLS_MIN = 12;

function resolveCapacity(choice: CapacityChoice, custom: string): number {
  if (choice !== 'custom') return Number(choice);
  const n = Math.floor(Number(custom));
  if (!Number.isFinite(n)) return 0;
  return Math.max(6, Math.min(64, n));
}

export function TournoisDesktop() {
  const { tournaments, me, refresh } = useLeagueData();
  const { game } = useGameMode();
  const flash = useFlash();
  const isAdmin = !!me?.isAdmin;

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacityChoice, setCapacityChoice] = useState<CapacityChoice>('8');
  const [customCapacity, setCustomCapacity] = useState('12');
  const [paramsOpen, setParamsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const capacity = resolveCapacity(capacityChoice, customCapacity);

  const active = tournaments.filter((t) => t.status === 'in_progress');
  const inPrep = tournaments.filter((t) => t.status === 'registration');
  const past = tournaments.filter((t) => t.status === 'finished' || t.status === 'cancelled');

  const openParams = () => {
    if (name.trim().length < 2) { flash.show('Nom requis (2 caractères min)', 'error'); return; }
    if (capacity < 6) { flash.show('Capacité : 6 joueurs minimum', 'error'); return; }
    setParamsOpen(true);
  };

  const CAPACITY_OPTIONS: { value: CapacityChoice; label: string }[] = [
    { value: '6', label: '6' },
    { value: '8', label: '8' },
    { value: '16', label: '16' },
    { value: 'custom', label: '…' },
  ];

  return (
    <Panel title="Tournois" sub="Brackets · poules & élim" accent="trophy">

      {/* ── Hero CTAs — les 2 chemins en évidence ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Amical — tout le monde */}
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
          {!createOpen ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="shine group relative w-full overflow-hidden rounded-2xl border-2 border-gold/45 hover:border-gold
                flex items-center gap-5 px-6 py-5 text-left transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(50,38,12,0.7) 0%, rgba(20,16,6,0.9) 100%)',
                boxShadow: '0 0 28px rgba(255,201,74,0.14)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gold/10 via-gold/3 to-transparent opacity-80 pointer-events-none" />
              <span className="relative flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-xl"
                style={{ background: 'rgba(255,201,74,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,247,228,0.18)' }}>
                <Swords className="w-7 h-7 text-gold" strokeWidth={2.2} />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block font-display text-xl font-black text-gold tracking-tight mb-0.5">
                  Tournoi amical
                </span>
                <span className="block text-[11px] text-muted-2 uppercase tracking-[0.14em]">
                  Ouvert à tous · sans impact ELO
                </span>
              </span>
              <span className="relative text-gold/50 group-hover:text-gold group-hover:translate-x-1 transition-all">→</span>
            </button>
          ) : (
            /* Formulaire inline */
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-gold/40 p-5"
              style={{ background: 'rgba(30,24,10,0.95)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-display text-base font-black text-gold">Nouveau tournoi amical</span>
                <button type="button" onClick={() => setCreateOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-muted-2 hover:text-text hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openParams()}
                  placeholder="Nom du tournoi…"
                  maxLength={60}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-bg-1 border border-border rounded-xl text-sm focus:border-gold outline-none transition-colors"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted uppercase tracking-wider font-bold flex-shrink-0">Joueurs</span>
                  <div className="flex gap-1.5">
                    {CAPACITY_OPTIONS.map((o) => (
                      <button key={o.value} type="button" onClick={() => setCapacityChoice(o.value)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold transition-all ${
                          capacityChoice === o.value
                            ? 'border-gold/50 bg-gold/10 text-gold'
                            : 'border-border text-muted-2 hover:border-gold/30'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                    {capacityChoice === 'custom' && (
                      <input type="number" min={6} max={64} value={customCapacity}
                        onChange={(e) => setCustomCapacity(e.target.value)}
                        className="w-14 px-2 py-1 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none" />
                    )}
                  </div>
                </div>
                <Button onClick={openParams} className="w-full">Créer le tournoi →</Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Officiel — admins only */}
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-gold/25 flex items-center gap-5 px-6 py-5 ${isAdmin ? 'hover:border-gold/40' : 'opacity-60 cursor-not-allowed'}`}
          style={{ background: 'linear-gradient(135deg, rgba(30,20,8,0.7) 0%, rgba(14,12,6,0.9) 100%)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent pointer-events-none" />
          <span className="relative flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-xl bg-gold/10">
            <Crown className="w-7 h-7 text-gold/70" strokeWidth={2.2} />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block font-display text-xl font-black text-gold/80 tracking-tight mb-0.5">
              Tournoi officiel
            </span>
            <span className="block text-[11px] text-muted-2 uppercase tracking-[0.14em]">
              {isAdmin ? 'ELO impacté · récompenses exclusives' : 'Réservé aux administrateurs'}
            </span>
          </span>
          <span className="relative text-[9px] font-extrabold uppercase tracking-wider text-gold/50 border border-gold/25 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
      </div>

      {/* Modal création (params) */}
      {paramsOpen && (
        <CreateTournamentModal
          name={name.trim()}
          capacity={capacity}
          isAdmin={isAdmin}
          onClose={() => setParamsOpen(false)}
          onCreated={async () => {
            setParamsOpen(false);
            setCreateOpen(false);
            setName('');
            await refresh();
          }}
        />
      )}

      {/* ── Liste des tournois ───────────────────────────────────────────────── */}
      {tournaments.length === 0 ? (
        <EmptyTournois onCreateClick={() => setCreateOpen(true)} game={game} />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && <TournoiGroup label="En cours" tone="gold" items={active} />}
          {inPrep.length > 0 && <TournoiGroup label="Inscriptions ouvertes" tone="teal" items={inPrep} />}
          {past.length > 0 && <TournoiGroup label="Historique" tone="muted" items={past} />}
        </div>
      )}

      {/* ── Aide discrète ──────────────────────────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-border/30">
        <button type="button" onClick={() => setHelpOpen((o) => !o)}
          className="flex items-center gap-2 text-[11px] text-muted-2 hover:text-muted transition-colors">
          <Info className="w-3.5 h-3.5" strokeWidth={2} />
          Comment ça marche ?
        </button>
        <AnimatePresence>
          {helpOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden">
              <div className="grid grid-cols-2 gap-3 mt-3">
                {[
                  { n: '1', t: 'Clique sur "Tournoi amical", donne un nom et la capacité.' },
                  { n: '2', t: 'Choisis format (Élimination / Poules) et visibilité.' },
                  { n: '3', t: 'Les joueurs rejoignent — tu démarres quand tu veux.' },
                  { n: '4', t: 'Chaque match : saisir le score et le faire confirmer.' },
                ].map(({ n, t }) => (
                  <div key={n} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-border/30 text-[11px] text-muted-2">
                    <span className="w-5 h-5 rounded-full bg-gold/15 text-gold text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{n}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

// ─── Empty state visuel ───────────────────────────────────────────────────────

function EmptyTournois({ onCreateClick, game }: { onCreateClick: () => void; game: string }) {
  const gameEmoji = game === 'smash' ? '🎮' : game === 'chess' ? '♟' : '⚽';
  return (
    <div className="flex flex-col items-center text-center py-16">
      <div className="relative mb-6 w-24 h-24">
        <div className="absolute inset-0 bg-gold/15 blur-2xl rounded-full" />
        <Trophy className="relative w-full h-full text-gold/60" strokeWidth={1.2} />
        <span className="absolute -bottom-1 -right-1 text-2xl">{gameEmoji}</span>
      </div>
      <h3 className="font-display text-2xl font-black text-text-strong mb-2">
        Lance le premier tournoi !
      </h3>
      <p className="text-sm text-muted-2 max-w-md mb-6 leading-relaxed">
        Réunis tes collègues, génère un bracket en un clic, et que le meilleur gagne.
        Amical (sans impact ELO) ou officiel avec récompenses.
      </p>
      <div className="flex gap-3 items-center">
        <button type="button" onClick={onCreateClick}
          className="shine flex items-center gap-2.5 px-6 py-3 rounded-xl border-2 border-gold/50 hover:border-gold
            bg-gold/10 hover:bg-gold/15 text-gold font-extrabold text-sm uppercase tracking-wider transition-all">
          <Swords className="w-4 h-4" strokeWidth={2.5} />
          Créer un tournoi amical
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
        <div className="flex flex-wrap gap-2">
          {['⚡ Élimination', '🏊 Poules', '6+ joueurs'].map((tag) => (
            <span key={tag} className="text-[11px] text-muted-2 px-3 py-1.5 rounded-full border border-border/50 bg-white/[0.02]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Groupe de tournois ───────────────────────────────────────────────────────

type GroupTone = 'gold' | 'teal' | 'muted';
const GROUP_BAR: Record<GroupTone, string> = { gold: 'from-gold to-gold-dim', teal: 'from-teal to-teal', muted: 'from-muted to-muted/40' };
const GROUP_TXT: Record<GroupTone, string> = { gold: 'text-gold', teal: 'text-teal', muted: 'text-muted-2' };

function TournoiGroup({ label, tone, items }: { label: string; tone: GroupTone; items: Tournament[] }) {
  return (
    <section>
      <div className={`font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold mb-4 flex items-center gap-2 ${GROUP_TXT[tone]}`}>
        <span className={`inline-block w-1 h-2.5 bg-gradient-to-b ${GROUP_BAR[tone]} rounded-sm`} />
        {label}
        <span className="text-muted-2 font-mono text-[10px] normal-case">· {items.length}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent ml-1" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {items.map((t, i) => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.22 }}>
            <TournoiCard t={t} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Carte tournoi ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Tournament['status'], string> = {
  registration: 'INSCRIPTIONS', in_progress: 'EN COURS', finished: 'TERMINÉ', cancelled: 'ANNULÉ',
};
const STATUS_TONE: Record<Tournament['status'], string> = {
  registration: 'border-teal text-teal', in_progress: 'border-gold text-gold',
  finished: 'border-muted text-muted-2', cancelled: 'border-red text-red',
};

function TournoiCard({ t }: { t: Tournament }) {
  const count = t.entries?.length ?? 0;
  const art = tournamentArt(t.id);
  const fillPct = Math.min(100, Math.round((count / t.capacity) * 100));
  return (
    <Link
      to={`/tournaments/${encodeURIComponent(t.id)}`}
      className="group relative block rounded-xl overflow-hidden card-hud hover-glow transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Art en haut (format 4:3) */}
      <div className="relative aspect-video overflow-hidden">
        {t.imageUrl ? (
          <img src={t.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: art.background }} />
            {t.game === 'smash'
              ? <SmashTrophy accent={art.accent} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-80" />
              : t.game === 'chess'
              ? <ChessTrophy accent={art.accent} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-80" />
              : <TournamentCup accent={art.accent} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-80" />
            }
          </>
        )}
        {/* Badges haut */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border bg-black/50 backdrop-blur-sm ${STATUS_TONE[t.status]}`}>
            {STATUS_LABEL[t.status]}
          </span>
          {t.game && t.game !== 'babyfoot' && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm border border-accent/30 text-accent">
              {t.game === 'smash' ? '🎮' : '♟'}
            </span>
          )}
        </div>
      </div>

      {/* Infos bas */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className={`inline-block text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
            t.kind === 'official' ? 'text-gold border-gold/50 bg-gold/10' : 'text-muted-2 border-border bg-transparent'
          }`}>
            {t.kind === 'official' ? '★ Officiel' : 'Amical'}
          </span>
          {t.isPrivate && <Lock className="w-3 h-3 text-teal flex-shrink-0 mt-0.5" strokeWidth={2.5} />}
        </div>

        <div className="font-semibold text-text-strong text-sm leading-tight mb-2 line-clamp-2">{t.name}</div>

        {/* Progress bar (inscriptions/en cours) */}
        {(t.status === 'registration' || t.status === 'in_progress') && (
          <div className="mb-1.5">
            <div className="h-1 rounded-full bg-bg-0/60 overflow-hidden mb-1">
              <div className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                style={{ width: `${fillPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[9px] text-muted-2">
              <span className="flex items-center gap-1">
                <Users className="w-2.5 h-2.5" strokeWidth={2.5} />
                {count}/{t.capacity}
              </span>
              {t.status === 'registration' && <span>{fillPct}%</span>}
            </div>
          </div>
        )}

        {t.winner && (
          <div className="text-[10px] text-gold font-bold truncate">🏆 {t.winner.login}</div>
        )}
      </div>
    </Link>
  );
}

// ─── Modal de création (paramètres) ──────────────────────────────────────────

function CreateTournamentModal({ name, capacity, isAdmin, onClose, onCreated }: {
  name: string; capacity: number; isAdmin: boolean;
  onClose: () => void; onCreated: () => Promise<void>;
}) {
  const flash = useFlash();
  const navigate = useNavigate();
  const { game } = useGameMode();
  const [kind, setKind] = useState<'friendly' | 'official'>('friendly');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [format, setFormat] = useState<'elimination' | 'pools'>('elimination');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const poolsAllowed = capacity >= POOLS_MIN;
  const effectiveFormat = poolsAllowed ? format : 'elimination';

  const submit = async () => {
    setBusy(true);
    try {
      const img = imageUrl.trim();
      const tNew = await api.createTournament({
        name, capacity, kind, format: effectiveFormat, game,
        private: visibility === 'private',
        ...(img ? { imageUrl: img } : {}),
      });
      flash.show(`Tournoi "${tNew.name}" créé`);
      await onCreated();
      navigate(`/tournaments/${encodeURIComponent(tNew.id)}`);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="relative w-full max-w-lg rounded-2xl border border-gold/25 bg-bg-1 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center gap-3 px-5 py-4 border-b border-gold/15 bg-bg-2/40">
          {game === 'smash' ? <SmashTrophy accent="#ff4d5c" className="w-10 h-10 shrink-0" />
            : game === 'chess' ? <ChessTrophy accent="#56c46e" className="w-10 h-10 shrink-0" />
            : <TournamentCup accent="#ffc94a" className="w-10 h-10 shrink-0" />}
          <div className="min-w-0">
            <div className="font-gaming text-sm font-extrabold uppercase tracking-[0.12em] text-text-strong truncate">{name}</div>
            <div className="text-[11px] text-muted-2">{capacity} joueurs · derniers réglages</div>
          </div>
          <button onClick={onClose} aria-label="Fermer"
            className="ml-auto grid place-items-center w-8 h-8 rounded-lg text-muted-2 hover:text-text hover:bg-bg-2 transition-colors">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Type">
            <Pills<'friendly' | 'official'> value={kind}
              onChange={(v) => {
                if (v === 'official' && !isAdmin) { flash.show('Officiel : réservé aux admins', 'error'); return; }
                setKind(v);
              }}
              choices={[{ value: 'friendly', label: 'Amical' }, { value: 'official', label: isAdmin ? 'Officiel' : '🔒 Officiel' }]}
            />
          </Field>
          <Field label="Visibilité" hint={visibility === 'private' ? 'Sur invitation uniquement' : 'Inscription ouverte à tous'}>
            <Pills<'public' | 'private'> value={visibility} onChange={setVisibility}
              choices={[{ value: 'public', label: 'Public' }, { value: 'private', label: 'Privé' }]}
            />
          </Field>
          <Field label="Format" hint={poolsAllowed
            ? effectiveFormat === 'pools' ? 'Poules de 4 · 2 qualifiés → bracket' : 'Bracket à élimination directe'
            : `Poules disponibles à partir de ${POOLS_MIN} joueurs`
          }>
            <Pills<'elimination' | 'pools'> value={effectiveFormat}
              onChange={(v) => { if (v === 'pools' && !poolsAllowed) { flash.show(`Poules : ${POOLS_MIN} joueurs min`, 'error'); return; } setFormat(v); }}
              choices={[{ value: 'elimination', label: 'Élimination' }, { value: 'pools', label: poolsAllowed ? 'Poules' : '🔒 Poules' }]}
            />
          </Field>
          <Field label="Photo de couverture" hint="URL · sinon une coupe est générée">
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…" inputMode="url"
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors" />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
            <Button loading={busy} onClick={submit} className="flex-[2]">Créer le tournoi</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-muted-2">{hint}</p>}
    </div>
  );
}
