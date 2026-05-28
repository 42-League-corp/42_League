import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Plus } from 'lucide-react';
import { haptic } from '../feedback/useHaptic';

interface FABAction {
  Icon?: LucideIcon;
  label?: string;
  onClick: () => void;
  /** Si true, le bouton respire avec un glow périodique. */
  pulse?: boolean;
}

// Entrée stockée en interne — onClick passe par une ref pour ne pas dépendre
// de l'identité de la fonction (sinon on déclenche une boucle de re-render).
interface FABEntry {
  id: string;
  Icon?: LucideIcon;
  label?: string;
  pulse?: boolean;
  onClickRef: { current: () => void };
}

interface FABContextValue {
  setEntry: (id: string, entry: Omit<FABEntry, 'id'> | null) => void;
}

const FABContext = createContext<FABContextValue | null>(null);

/**
 * Provider FAB monté une fois au niveau du shell mobile. Toute page qui veut
 * afficher un FAB appelle `useFAB({...})`. Un seul bouton est rendu (la dernière
 * entrée enregistrée). Garantit qu'il n'y a JAMAIS plusieurs FABs simultanés,
 * même pendant les transitions de page (popLayout).
 */
export function FABProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<FABEntry[]>([]);

  const setEntry = useCallback((id: string, entry: Omit<FABEntry, 'id'> | null) => {
    setStack((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      return entry ? [...filtered, { id, ...entry }] : filtered;
    });
  }, []);

  const ctx = useMemo<FABContextValue>(() => ({ setEntry }), [setEntry]);
  const current = stack[stack.length - 1];

  return (
    <FABContext.Provider value={ctx}>
      {children}
      <FABRenderer entry={current} />
    </FABContext.Provider>
  );
}

/**
 * Hook utilisé par les pages pour publier leur action FAB.
 *
 * Les ré-enregistrements ne se font QUE sur changement de label/Icon/pulse —
 * l'onClick est routé via une ref, donc une fonction recréée à chaque render
 * ne re-déclenche pas la pile (et donc pas de boucle infinie).
 *
 * Pour ne plus rien afficher, passer `null`.
 */
export function useFAB(action: FABAction | null) {
  const ctx = useContext(FABContext);
  const id = useId();

  // Ref stable mise à jour à chaque render — onClick le plus à jour est toujours appelé.
  const onClickRef = useRef<() => void>(() => {});
  if (action) onClickRef.current = action.onClick;

  const Icon = action?.Icon;
  const label = action?.label;
  const pulse = action?.pulse;
  const enabled = !!action;

  useEffect(() => {
    if (!ctx) return;
    if (!enabled) {
      ctx.setEntry(id, null);
      return;
    }
    ctx.setEntry(id, { Icon, label, pulse, onClickRef });
    return () => ctx.setEntry(id, null);
  }, [ctx, id, enabled, Icon, label, pulse]);
}

function FABRenderer({ entry }: { entry: FABEntry | undefined }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {entry && <FABButton key="fab" entry={entry} />}
    </AnimatePresence>,
    document.body,
  );
}

function FABButton({ entry }: { entry: FABEntry }) {
  const { Icon = Plus, label, pulse = false, onClickRef } = entry;
  return (
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        haptic('medium');
        onClickRef.current();
      }}
      aria-label={label}
      className={`shine flex items-center justify-center gap-2 h-14 px-5 rounded-full text-[#1a0d00] font-display font-black text-sm uppercase tracking-wider tap-transparent border border-gold/60 ${
        pulse ? 'animate-glow-pulse' : ''
      }`}
      style={{
        position: 'fixed',
        right: 'calc(16px + env(safe-area-inset-right))',
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        zIndex: 50,
        background:
          'linear-gradient(180deg, #ffd97a 0%, #f5b942 55%, #c79122 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,247,228,0.55), inset 0 -1px 0 rgba(0,0,0,0.32), 0 8px 24px rgba(255,201,74,0.4), 0 0 32px rgba(255,201,74,0.22)',
      }}
    >
      <Icon className="w-5 h-5 relative z-10" strokeWidth={3} />
      {label && <span className="relative z-10">{label}</span>}
    </motion.button>
  );
}

// ── Compat ancienne API ────────────────────────────────────────────────────
// Conserve l'ancien export <FAB ... /> pour ne pas casser les pages existantes.
export function FAB(props: FABAction) {
  useFAB(props);
  return null;
}
