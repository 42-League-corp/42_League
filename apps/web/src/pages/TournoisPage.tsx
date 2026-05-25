import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Pills } from '../components/Pills';
import { api, type Tournament } from '../lib/api';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';

export function TournoisPage() {
  const { tournaments, me, refresh } = useLeagueData();
  const flash = useFlash();
  const navigate = useNavigate();
  const isAdmin = !!me?.isAdmin;

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<4 | 8>(4);
  const [kind, setKind] = useState<'friendly' | 'official'>('friendly');
  const [busy, setBusy] = useState(false);

  return (
    <Panel title="Tournois" sub="Brackets · single-élim">
      {/* Create */}
      <div className="mb-6 border-b border-border pb-6">
        <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
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
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du tournoi (ex. Coupe du Havre)"
            className="px-3 py-2 bg-bg-2 border border-border rounded text-sm focus:border-teal outline-none"
          />
          <select
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) as 4 | 8)}
            className="px-3 py-2 bg-bg-2 border border-border rounded text-sm focus:border-teal outline-none"
          >
            <option value={4}>4 joueurs</option>
            <option value={8}>8 joueurs</option>
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
                });
                flash.show(`Tournoi "${tNew.name}" créé`);
                await refresh();
                navigate(`/tournois/${encodeURIComponent(tNew.id)}`);
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
        <div className="text-center text-muted-2 py-10">Aucun tournoi pour le moment.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tournaments.map((t) => (
            <TournoiCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </Panel>
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
      to={`/tournois/${encodeURIComponent(t.id)}`}
      className="block p-4 border border-border bg-bg-2/40 rounded hover:border-teal/60 hover:bg-bg-2/70 transition"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="font-extrabold text-text-strong text-base truncate">
            {t.name}
          </div>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
              t.kind === 'official'
                ? 'text-gold border-gold/50 bg-gold/10'
                : 'text-muted-2 border-border'
            }`}
          >
            {t.kind === 'official' ? '★ OFFICIEL' : 'AMICAL'}
          </span>
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
