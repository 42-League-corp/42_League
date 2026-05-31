import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { Button } from '../../components/Button';
import { Pills } from '../../components/Pills';
import { Trophy, Lock, X } from 'lucide-react';
import { api, type Tournament } from '../../lib/api';
import { tournamentArt } from '../../lib/tournamentArt';
import { TournamentCup } from '../../components/TournamentCup';
import { SmashTrophy } from '../../components/SmashTrophy';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useFlash } from '../../hooks/useFlash';

type CapacityChoice = '6' | '8' | 'custom';
const POOLS_MIN = 12;

function resolveCapacity(choice: CapacityChoice, custom: string): number {
  if (choice !== 'custom') return Number(choice);
  const n = Math.floor(Number(custom));
  if (!Number.isFinite(n)) return 0;
  return Math.max(6, Math.min(64, n));
}

/**
 * Vue desktop des tournois — identique à l'ancienne TournoisPage, reposée ici
 * pour le Split View pattern.
 */
export function TournoisDesktop() {
  const { tournaments, me, refresh } = useLeagueData();
  const flash = useFlash();
  const isAdmin = !!me?.isAdmin;

  const [name, setName] = useState('');
  const [capacityChoice, setCapacityChoice] = useState<CapacityChoice>('8');
  const [customCapacity, setCustomCapacity] = useState('12');
  const [paramsOpen, setParamsOpen] = useState(false);

  const capacity = resolveCapacity(capacityChoice, customCapacity);

  // Regroupement par état : en cours (vivants) → en préparation (inscriptions) → historique (terminés).
  const active = tournaments.filter((t) => t.status === 'in_progress');
  const inPrep = tournaments.filter((t) => t.status === 'registration');
  const past = tournaments.filter((t) => t.status === 'finished' || t.status === 'cancelled');

  const openParams = () => {
    if (name.trim().length < 2) {
      flash.show('Nom requis (2 caractères min)', 'error');
      return;
    }
    if (capacity < 6) {
      flash.show('Capacité : 6 joueurs minimum', 'error');
      return;
    }
    setParamsOpen(true);
  };

  const CAPACITY_OPTIONS: { value: CapacityChoice; label: string }[] = [
    { value: '6', label: '6 joueurs' },
    { value: '8', label: '8 joueurs' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <Panel title="Tournois" sub="Brackets · poules & élim" accent="trophy">
      <div className="mb-6 border-b border-gold/15 pb-6">
        <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold font-extrabold mb-3 flex items-center gap-2">
          <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
          Créer un tournoi
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openParams()}
            placeholder="Nom du tournoi (ex. Coupe du Havre)"
            maxLength={60}
            className="px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
          />
          <div className="flex gap-2">
            <Pills<CapacityChoice>
              value={capacityChoice}
              onChange={setCapacityChoice}
              choices={CAPACITY_OPTIONS}
            />
            {capacityChoice === 'custom' && (
              <input
                type="number"
                min={6}
                max={64}
                value={customCapacity}
                onChange={(e) => setCustomCapacity(e.target.value)}
                className="w-20 px-2 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors tabular-nums"
              />
            )}
          </div>
          <Button onClick={openParams}>Créer</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-2">
          Tu choisiras la photo, la visibilité et le format (poules ou élimination directe) à
          l'étape suivante. Les poules s'activent à partir de {POOLS_MIN} joueurs.
        </p>
      </div>

      {paramsOpen && (
        <CreateTournamentModal
          name={name.trim()}
          capacity={capacity}
          isAdmin={isAdmin}
          onClose={() => setParamsOpen(false)}
          onCreated={async () => {
            setParamsOpen(false);
            setName('');
            await refresh();
          }}
        />
      )}

      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-gold/20 blur-2xl rounded-full" />
            <Trophy className="relative w-16 h-16 text-gold/70" strokeWidth={1.5} />
          </div>
          <h3 className="font-gaming text-lg font-extrabold uppercase tracking-[0.14em] text-text-strong mb-1.5">
            Aucun tournoi pour le moment
          </h3>
          <p className="text-sm text-muted-2 max-w-sm mb-5">
            Lance le premier bracket de la ligue — crée un tournoi amical (6, 8 ou plus
            de joueurs) avec le formulaire ci-dessus et désigne le champion sur le terrain.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-2">
            <span className="card-hud rounded-full px-3 py-1.5">Élimination ou poules</span>
            <span className="card-hud rounded-full px-3 py-1.5">6 joueurs et +</span>
            <span className="card-hud rounded-full px-3 py-1.5">Bracket automatique</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <TournoiGroup label="Tournois en cours" tone="gold" items={active} />
          )}
          {inPrep.length > 0 && (
            <TournoiGroup label="Tournois en préparation" tone="teal" items={inPrep} />
          )}
          <TournoiGroup label="Historique des tournois" tone="muted" items={past} />
        </div>
      )}

      {/* ─── Comment lancer un tournoi ? ─────────────────────────────────── */}
      <div className="mt-6 pt-6 border-t border-gold/15">
        <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold font-extrabold mb-3 flex items-center gap-2">
          <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
          Comment ça marche ?
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card-hud rounded-xl p-4">
            <h3 className="font-gaming text-xs font-extrabold uppercase tracking-[0.16em] text-teal mb-2">
              🎲 Tournoi amical
            </h3>
            <p className="text-xs text-muted-2 leading-relaxed">
              Tout le monde peut en lancer un : choisis un nom, le nombre de joueurs et le
              format (élimination ou poules), puis démarre le bracket. Idéal pour s'amuser
              entre collègues — sans impact sur le classement.
            </p>
          </div>
          <div className="card-hud rounded-xl p-4 border-gold/40">
            <h3 className="font-gaming text-xs font-extrabold uppercase tracking-[0.16em] text-gold mb-2">
              👑 Tournoi officiel
            </h3>
            <p className="text-xs text-muted-2 leading-relaxed">
              Réservé aux admins : seuls les administrateurs peuvent les lancer. En
              échange, ils donnent lieu à des récompenses très spéciales —{' '}
              <span className="text-gold font-semibold">titres exclusifs</span>,{' '}
              <span className="text-gold font-semibold">League Coins</span> et{' '}
              <span className="text-gold font-semibold">cosmétiques</span>.
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

type GroupTone = 'gold' | 'teal' | 'muted';

const GROUP_BAR: Record<GroupTone, string> = {
  gold: 'from-gold to-gold-dim',
  teal: 'from-teal to-teal',
  muted: 'from-muted to-muted/40',
};
const GROUP_TXT: Record<GroupTone, string> = {
  gold: 'text-gold',
  teal: 'text-teal',
  muted: 'text-muted-2',
};

/**
 * Section de tournois groupée par état, avec en-tête doré façon « cartouche ».
 * L'historique s'affiche même vide (donne du contenu à la page).
 */
function TournoiGroup({ label, tone, items }: { label: string; tone: GroupTone; items: Tournament[] }) {
  return (
    <section>
      <div
        className={`font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold mb-3 flex items-center gap-2 ${GROUP_TXT[tone]}`}
      >
        <span className={`inline-block w-1 h-2.5 bg-gradient-to-b ${GROUP_BAR[tone]} rounded-sm`} />
        {label}
        <span className="text-muted-2 font-mono text-[10px] normal-case">· {items.length}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent ml-1" />
      </div>
      {items.length === 0 ? (
        <div className="card-hud rounded-xl px-4 py-6 text-center text-xs text-muted-2">
          Aucun tournoi terminé pour l'instant — les champions s'afficheront ici.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 items-start">
          {items.map((t) => (
            <TournoiCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<Tournament['status'], string> = {
  registration: 'INSCRIPTIONS',
  in_progress: 'EN COURS',
  finished: 'TERMINÉ',
  cancelled: 'ANNULÉ',
};

const STATUS_TONE: Record<Tournament['status'], string> = {
  registration: 'border-teal text-teal',
  in_progress: 'border-gold text-gold',
  finished: 'border-muted text-muted-2',
  cancelled: 'border-red text-red',
};

function TournoiCard({ t }: { t: Tournament }) {
  const count = t.entries?.length ?? 0;
  const art = tournamentArt(t.id);
  return (
    <Link
      to={`/tournaments/${encodeURIComponent(t.id)}`}
      className="group relative block aspect-square rounded-xl overflow-hidden card-hud hover-glow transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Fond : image fournie, sinon visuel par défaut généré (coupe dessinée) */}
      {t.imageUrl ? (
        <img
          src={t.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: art.background }} />
          {t.game === 'smash' ? (
            <SmashTrophy
              accent={art.accent}
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-28 h-28 opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <TournamentCup
              accent={art.accent}
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 w-28 h-28 opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </>
      )}
      {/* Voile pour la lisibilité du texte */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

      {/* Badges haut */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2">
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border bg-black/40 backdrop-blur-sm ${STATUS_TONE[t.status]}`}
        >
          {STATUS_LABEL[t.status]}
        </span>
        {t.isPrivate && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border text-teal border-teal/40 bg-black/40 backdrop-blur-sm">
            <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
            Privé
          </span>
        )}
      </div>

      {/* Contenu bas */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <span
          className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border mb-1.5 ${
            t.kind === 'official'
              ? 'text-gold border-gold/50 bg-gold/10'
              : 'text-muted-2 border-border bg-black/30'
          }`}
        >
          {t.kind === 'official' ? '★ OFFICIEL' : 'AMICAL'}
        </span>
        <div
          className="font-extrabold text-text-strong text-base leading-tight overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {t.name}
        </div>
        <div className="text-[11px] text-muted-2 mt-1">
          {count}/{t.capacity} joueurs · org. <span className="text-text">{t.createdByLogin}</span>
        </div>
        {t.winner && (
          <div className="text-[11px] text-gold font-bold mt-0.5 truncate">🏆 {t.winner.login}</div>
        )}
      </div>
    </Link>
  );
}

/**
 * Étape « paramètres » de la création : photo, visibilité (privé = sur invitation),
 * format (élimination directe ou poules), et type (officiel réservé aux admins).
 * S'ouvre après avoir saisi le nom et la capacité.
 */
function CreateTournamentModal({
  name,
  capacity,
  isAdmin,
  onClose,
  onCreated,
}: {
  name: string;
  capacity: number;
  isAdmin: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
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
        name,
        capacity,
        kind,
        format: effectiveFormat,
        game,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-gold/25 bg-bg-1 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête avec aperçu trophée (coupe babyfoot / Smash Ball smash) */}
        <div className="relative flex items-center gap-3 px-5 py-4 border-b border-gold/15 bg-bg-2/40">
          {game === 'smash' ? (
            <SmashTrophy accent="#ff4d5c" className="w-10 h-10 shrink-0" />
          ) : (
            <TournamentCup accent="#ffc94a" className="w-10 h-10 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-gaming text-sm font-extrabold uppercase tracking-[0.12em] text-text-strong truncate">
              {name}
            </div>
            <div className="text-[11px] text-muted-2">{capacity} joueurs · derniers réglages</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto grid place-items-center w-8 h-8 rounded-lg text-muted-2 hover:text-text hover:bg-bg-2 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type */}
          <Field label="Type">
            <Pills<'friendly' | 'official'>
              value={kind}
              onChange={(v) => {
                if (v === 'official' && !isAdmin) {
                  flash.show('Officiel : réservé aux admins', 'error');
                  return;
                }
                setKind(v);
              }}
              choices={[
                { value: 'friendly', label: 'Amical' },
                { value: 'official', label: isAdmin ? 'Officiel' : '🔒 Officiel' },
              ]}
            />
          </Field>

          {/* Visibilité */}
          <Field
            label="Visibilité"
            hint={visibility === 'private' ? 'Sur invitation uniquement' : 'Inscription ouverte à tous'}
          >
            <Pills<'public' | 'private'>
              value={visibility}
              onChange={setVisibility}
              choices={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Privé' },
              ]}
            />
          </Field>

          {/* Format */}
          <Field
            label="Format"
            hint={
              poolsAllowed
                ? effectiveFormat === 'pools'
                  ? 'Poules de 4 · 2 qualifiés par poule, puis bracket'
                  : 'Bracket à élimination directe'
                : `Poules disponibles à partir de ${POOLS_MIN} joueurs`
            }
          >
            <Pills<'elimination' | 'pools'>
              value={effectiveFormat}
              onChange={(v) => {
                if (v === 'pools' && !poolsAllowed) {
                  flash.show(`Poules : ${POOLS_MIN} joueurs minimum`, 'error');
                  return;
                }
                setFormat(v);
              }}
              choices={[
                { value: 'elimination', label: 'Élimination' },
                { value: 'pools', label: poolsAllowed ? 'Poules' : '🔒 Poules' },
              ]}
            />
          </Field>

          {/* Photo */}
          <Field label="Photo de couverture" hint="URL · sinon une coupe est générée">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              className="w-full px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button loading={busy} onClick={submit} className="flex-[2]">
              Créer le tournoi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-muted-2">{hint}</p>}
    </div>
  );
}
