import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap } from 'lucide-react';
import { Button } from './Button';
import { api } from '../lib/api';
import { useFlash } from '../hooks/useFlash';
import { haptic } from '../mobile/feedback/useHaptic';

interface TeamNameModalProps {
  /** ID de l'équipe à nommer. null = fermée. */
  teamId: string | null;
  /** Logins des deux joueurs de l'équipe (pour l'affichage). */
  player1Login: string;
  player2Login: string;
  onClose: () => void;
}

/**
 * Modale « Nouveau Duo détecté » — s'ouvre après la validation d'un match 2v2
 * lorsqu'une nouvelle association de joueurs est créée.
 *
 * L'utilisateur peut nommer son équipe ou cliquer « Plus tard » pour sauter.
 * Isolée du flow principal : pas de connaissances des routes ni du state global.
 */
export function TeamNameModal({ teamId, player1Login, player2Login, onClose }: TeamNameModalProps) {
  const flash = useFlash();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = teamId !== null;

  // Autofocus l'input à l'ouverture (après l'animation d'entrée).
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 280);
      return () => window.clearTimeout(id);
    } else {
      setName('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!teamId || !name.trim()) return;
    setBusy(true);
    haptic('medium');
    try {
      await api.nameTeam(teamId, name.trim());
      flash.show(`Équipe "${name.trim()}" enregistrée !`);
      haptic('success');
      onClose();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : 'Erreur', 'error');
      haptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    haptic('selection');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#0b0906]/80 backdrop-blur-sm"
            onClick={handleSkip}
            aria-hidden
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-sm"
          >
            <div
              className="relative rounded-2xl overflow-hidden border border-gold/30"
              style={{
                background: 'linear-gradient(160deg, #1e1a12 0%, #161209 60%, #110e08 100%)',
                boxShadow:
                  '0 32px 80px -16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,215,120,0.12), 0 0 0 1px rgba(255,201,74,0.08)',
              }}
            >
              {/* Diag pattern */}
              <div className="absolute inset-0 hud-diag opacity-40 pointer-events-none" />

              {/* Gold top accent line */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

              {/* Close */}
              <button
                type="button"
                aria-label="Fermer"
                onClick={handleSkip}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-white/5 tap-transparent transition-colors z-10"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>

              <div className="relative px-6 pt-6 pb-7 space-y-5">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-gold/40 flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,201,74,0.25), rgba(255,201,74,0.08))',
                      boxShadow: '0 0 16px rgba(255,201,74,0.2)',
                    }}
                  >
                    <Zap className="w-5 h-5 text-gold" strokeWidth={2.5} fill="currentColor" />
                  </div>
                  <div>
                    <div className="font-gaming text-sm font-extrabold text-gold uppercase tracking-wide">
                      Nouveau Duo détecté !
                    </div>
                    <div className="text-[11px] text-muted-2 mt-0.5 leading-relaxed">
                      <span className="text-text font-semibold">{player1Login}</span>
                      {' & '}
                      <span className="text-text font-semibold">{player2Login}</span>
                    </div>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label
                    htmlFor="team-name-input"
                    className="block text-[10px] uppercase tracking-wider text-muted font-extrabold mb-2"
                  >
                    Nommez votre équipe pour entrer dans l'histoire :
                  </label>
                  <input
                    id="team-name-input"
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 30))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && name.trim()) handleSave();
                      if (e.key === 'Escape') handleSkip();
                    }}
                    placeholder="Les Bulldozers, Les Intouchables…"
                    maxLength={30}
                    className="w-full px-4 py-3 bg-bg-1 border-2 border-border rounded-xl text-sm font-medium focus:border-gold focus:shadow-[0_0_16px_rgba(255,201,74,0.18)] outline-none text-text-strong placeholder:text-muted transition-all allow-select"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-muted tabular-nums">{name.length}/30</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 py-2.5 rounded-xl border border-border text-xs font-extrabold uppercase tracking-wide text-muted-2 hover:text-text hover:border-border-strong transition-colors tap-transparent"
                  >
                    Plus tard
                  </button>
                  <Button
                    variant="primary"
                    size="md"
                    loading={busy}
                    disabled={!name.trim()}
                    onClick={handleSave}
                    className="flex-1"
                  >
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
