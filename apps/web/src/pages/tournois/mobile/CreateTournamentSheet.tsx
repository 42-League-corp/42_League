import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { Button } from '../../../components/Button';
import { api } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { haptic } from '../../../mobile/feedback/useHaptic';

type Capacity = 4 | 8;
type Kind = 'friendly' | 'official';

interface CreateTournamentSheetProps {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}

const CAPACITY_CHOICES: Capacity[] = [4, 8];

/**
 * BottomSheet de création de tournoi.
 * UX flow accompagnée comme la déclaration de game.
 */
export function CreateTournamentSheet({ open, onClose, onDone }: CreateTournamentSheetProps) {
  const flash = useFlash();
  const navigate = useNavigate();
  const { me } = useLeagueData();
  const isAdmin = !!me?.isAdmin;

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<Capacity>(4);
  const [kind, setKind] = useState<Kind>('friendly');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setCapacity(4);
    setKind('friendly');
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      flash.show('Nom requis', 'error');
      haptic('error');
      return;
    }
    setBusy(true);
    try {
      const tNew = await api.createTournament({ name: n, capacity, kind });
      flash.show(`Tournoi "${tNew.name}" créé`);
      haptic('success');
      await onDone();
      reset();
      onClose();
      navigate(`/tournois/${encodeURIComponent(tNew.id)}`);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title={
        <div className="flex items-baseline gap-2">
          <span className="gradient-text-brand">Créer un tournoi</span>
        </div>
      }
      snap={80}
    >
      <div className="px-5 pt-4 pb-2 space-y-5">
        {/* Type */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <KindButton
              active={kind === 'friendly'}
              onClick={() => {
                haptic('selection');
                setKind('friendly');
              }}
              label="Amical"
              hint="Ouvert à tous"
              tone="teal"
            />
            <KindButton
              active={kind === 'official'}
              onClick={() => {
                if (!isAdmin) {
                  flash.show('Officiel : réservé aux admins', 'error');
                  haptic('warning');
                  return;
                }
                haptic('selection');
                setKind('official');
              }}
              label="Officiel"
              hint={isAdmin ? 'Compte au classement' : '🔒 Admin only'}
              tone="gold"
              disabled={!isAdmin}
            />
          </div>
        </div>

        {/* Nom */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Nom du tournoi
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Coupe du Havre"
            autoFocus
            maxLength={60}
            className="w-full px-4 py-3.5 bg-bg-1 border-2 border-border rounded-xl text-base font-medium focus:border-teal outline-none text-text-strong placeholder:text-muted transition-all shadow-sm focus:shadow-md tap-transparent allow-select"
          />
        </div>

        {/* Capacité */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Capacité
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CAPACITY_CHOICES.map((c) => {
              const active = capacity === c;
              return (
                <motion.button
                  key={c}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptic('selection');
                    setCapacity(c);
                  }}
                  className={`relative flex flex-col items-center justify-center gap-1 py-4 rounded-xl border-2 tap-transparent transition-all ${
                    active
                      ? 'border-teal bg-teal/10 text-teal shadow-teal-glow'
                      : 'border-border bg-bg-2/50 text-muted-2'
                  }`}
                >
                  <Users className="w-5 h-5" strokeWidth={2.5} />
                  <span className="font-mono font-extrabold text-base tabular-nums">{c}</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold">joueurs</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Button
          loading={busy}
          onClick={submit}
          className="w-full py-3.5 text-sm"
          disabled={!name.trim()}
        >
          Créer le tournoi
        </Button>

        <p className="text-[10px] text-muted/70 text-center font-medium leading-relaxed pt-1">
          Tu deviendras automatiquement l'organisateur. Les inscriptions s'ouvriront immédiatement.
        </p>
      </div>
    </BottomSheet>
  );
}

interface KindButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  tone: 'teal' | 'gold';
  disabled?: boolean;
}

function KindButton({ active, onClick, label, hint, tone, disabled }: KindButtonProps) {
  const activeStyle =
    tone === 'teal' ? 'border-teal bg-teal/10 text-teal' : 'border-gold bg-gold/10 text-gold';
  return (
    <motion.button
      type="button"
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      onClick={onClick}
      className={`relative flex flex-col gap-0.5 py-3 px-3 rounded-xl border-2 tap-transparent transition-all text-left ${
        active ? activeStyle : 'border-border bg-bg-2/50 text-muted-2'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-sm font-extrabold uppercase tracking-wide">{label}</span>
      <span className="text-[10px] opacity-75 font-medium leading-tight">{hint}</span>
    </motion.button>
  );
}
