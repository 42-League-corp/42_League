import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';
import { useFlash } from '../../hooks/useFlash';
import { useLeagueData } from '../../hooks/useLeagueData';
import { haptic } from '../../mobile/feedback/useHaptic';

type Capacity = 8 | 16;

const CAPACITY_CHOICES: Array<{ value: Capacity; label: string; desc: string }> = [
  { value: 8, label: '8', desc: 'Bracket rapide · 3 tours' },
  { value: 16, label: '16', desc: 'Tournoi complet · 4 tours' },
];

export function CreateTournamentPage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const { refresh } = useLeagueData();

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<Capacity>(8);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      flash.show('Donne un nom au tournoi', 'error');
      haptic('error');
      return;
    }
    setBusy(true);
    try {
      const tNew = await api.createTournament({ name: n, capacity, kind: 'friendly' });
      flash.show(`Tournoi "${tNew.name}" créé`);
      haptic('success');
      await refresh();
      navigate(`/tournaments/${encodeURIComponent(tNew.id)}`, { replace: true });
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-bg-1 border border-border flex items-center justify-center active:scale-90 transition-transform tap-transparent shrink-0"
          aria-label="Retour"
        >
          <ArrowLeft className="w-4 h-4 text-muted" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal/15 flex items-center justify-center">
            <Swords className="w-4 h-4 text-teal" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-display text-lg font-black text-text-strong leading-none">
              Tournoi amical
            </h1>
            <p className="text-[10px] text-muted-2 font-medium">ELO non impacté · ouvert à tous</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Nom */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Nom du tournoi
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Ex. Coupe du Havre"
            autoFocus
            maxLength={60}
            className="w-full px-4 py-4 bg-bg-1 border-2 border-border rounded-xl text-base font-semibold focus:border-teal outline-none text-text-strong placeholder:text-muted transition-all shadow-sm focus:shadow-md allow-select"
          />
        </motion.div>

        {/* Capacité */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Nombre de joueurs
          </label>
          <div className="grid grid-cols-2 gap-3">
            {CAPACITY_CHOICES.map(({ value, label, desc }) => {
              const active = capacity === value;
              return (
                <motion.button
                  key={value}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    haptic('selection');
                    setCapacity(value);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-2xl border-2 tap-transparent transition-all ${
                    active
                      ? 'border-teal bg-teal/10 shadow-[0_0_16px_rgba(20,184,166,0.2)]'
                      : 'border-border bg-bg-2/50'
                  }`}
                >
                  <Users
                    className={`w-6 h-6 ${active ? 'text-teal' : 'text-muted-2'}`}
                    strokeWidth={2}
                  />
                  <span
                    className={`font-mono font-extrabold text-2xl tabular-nums ${
                      active ? 'text-teal' : 'text-text-strong'
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`text-[10px] font-medium text-center leading-tight ${
                      active ? 'text-teal/80' : 'text-muted-2'
                    }`}
                  >
                    {desc}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <Button
            loading={busy}
            onClick={submit}
            className="w-full py-4 text-sm font-extrabold"
            disabled={!name.trim()}
          >
            Créer le tournoi
          </Button>
          <p className="text-[10px] text-muted/60 text-center font-medium mt-3 leading-relaxed">
            Les inscriptions s'ouvriront immédiatement après création.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
