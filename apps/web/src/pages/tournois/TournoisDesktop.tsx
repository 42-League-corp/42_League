import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { Button } from '../../components/Button';
import { Pills } from '../../components/Pills';
import { Trophy, Lock } from 'lucide-react';
import { api, type Tournament } from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useFlash } from '../../hooks/useFlash';

type Capacity = 8 | 16;

/**
 * Vue desktop des tournois — identique à l'ancienne TournoisPage, reposée ici
 * pour le Split View pattern.
 */
export function TournoisDesktop() {
  const { tournaments, me, refresh } = useLeagueData();
  const flash = useFlash();
  const navigate = useNavigate();
  const isAdmin = !!me?.isAdmin;

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<Capacity>(8);
  const [kind, setKind] = useState<'friendly' | 'official'>('friendly');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [busy, setBusy] = useState(false);

  // Regroupement par état : en cours (vivants) → en préparation (inscriptions) → historique (terminés/annulés).
  const active = tournaments.filter((t) => t.status === 'in_progress');
  const inPrep = tournaments.filter((t) => t.status === 'registration');
  const past = tournaments.filter((t) => t.status === 'finished' || t.status === 'cancelled');

  return (
    <Panel title="Tournois" sub="Brackets · single-élim">
      <div className="mb-6 border-b border-gold/15 pb-6">
        <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold font-extrabold mb-2 flex items-center gap-2">
          <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
          Créer un tournoi
        </div>
        <div className="flex flex-wrap gap-3 mb-3 items-center">
          <Pills<'friendly' | 'official'>
            value={kind}
            onChange={setKind}
            choices={
              isAdmin
                ? [
                    { value: 'friendly', label: 'Amical' },
                    { value: 'official', label: 'Officiel' },
                  ]
                : [{ value: 'friendly', label: 'Amical' }]
            }
          />
          {!isAdmin && (
            <span className="text-[10px] text-muted uppercase tracking-wider">
              Officiel : réservé aux admins
            </span>
          )}
          <Pills<'public' | 'private'>
            value={visibility}
            onChange={setVisibility}
            choices={[
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Privé' },
            ]}
          />
          {visibility === 'private' && (
            <span className="text-[10px] text-muted uppercase tracking-wider">
              Sur invitation uniquement
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du tournoi (ex. Coupe du Havre)"
            className="px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
          />
          <select
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) as Capacity)}
            className="px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm focus:border-gold outline-none transition-colors"
          >
            <option value={8}>8 joueurs</option>
            <option value={16}>16 joueurs</option>
          </select>
          <Button
            loading={busy}
            onClick={async () => {
              const n = name.trim();
              if (!n) {
                flash.show('Nom requis', 'error');
                return;
              }
              setBusy(true);
              try {
                const tNew = await api.createTournament({
                  name: n,
                  capacity,
                  kind,
                  private: visibility === 'private',
                });
                flash.show(`Tournoi "${tNew.name}" créé`);
                await refresh();
                navigate(`/tournaments/${encodeURIComponent(tNew.id)}`);
              } catch (err) {
                flash.show(err instanceof Error ? err.message : String(err), 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            Créer
          </Button>
        </div>
      </div>

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
            Lance le premier bracket de la ligue — crée un tournoi amical à 8 ou 16
            joueurs avec le formulaire ci-dessus et désigne le champion sur le terrain.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-2">
            <span className="card-hud rounded-full px-3 py-1.5">Single-élimination</span>
            <span className="card-hud rounded-full px-3 py-1.5">8 ou 16 joueurs</span>
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
              Tout le monde peut en lancer un : choisis un nom, 8 ou 16 joueurs, puis
              démarre le bracket avec le formulaire ci-dessus. Idéal pour s'amuser entre
              collègues — sans impact sur le classement.
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
  return (
    <Link
      to={`/tournaments/${encodeURIComponent(t.id)}`}
      className="block card-hud p-4 rounded-xl hover-glow transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-extrabold text-text-strong text-base truncate">{t.name}</div>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
              t.kind === 'official'
                ? 'text-gold border-gold/50 bg-gold/10'
                : 'text-muted-2 border-border'
            }`}
          >
            {t.kind === 'official' ? '★ OFFICIEL' : 'AMICAL'}
          </span>
          {t.isPrivate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border text-teal border-teal/40 bg-teal/10">
              <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
              Privé
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider border ${STATUS_TONE[t.status]}`}
        >
          {STATUS_LABEL[t.status]}
        </span>
      </div>
      <div className="text-xs text-muted-2 mt-1.5">
        {count}/{t.capacity} joueurs · org.{' '}
        <span className="text-text-strong">{t.createdByLogin}</span>
        {t.winner && (
          <>
            {' · vainqueur '}
            <span className="text-gold font-bold">{t.winner.login}</span>
          </>
        )}
      </div>
    </Link>
  );
}
