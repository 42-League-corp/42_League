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
// de l'identité de la fonction (sinon on déclenche une boucle d'effects).
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
 * Provider FAB monté une fois au niveau du shell mobile.
 *
 * Pattern « single-entry, last-writer-wins, owner-checked release » :
 * - Une seule slot d'entrée vivante à la fois.
 * - L'enregistrement est idempotent : ré-appeler setEntry avec la même id
 *   ne casse rien (typique des re-renders sur changement de `pulse`).
 * - Le release ne vide la slot QUE si l'appelant est encore propriétaire —
 *   ça neutralise la course de cleanup pendant les transitions `popLayout`,
 *   où la page sortante reste montée pendant que la nouvelle s'enregistre.
 *
 * Résultat : zéro bouton fantôme, zéro flicker entre pages, même sous
 * AnimatePresence + Suspense + StrictMode.
 */
export function FABProvider({ children }: { children: ReactNode }) {
  const [entry, setEntryState] = useState<FABEntry | null>(null);
  const ownerRef = useRef<string | null>(null);

  const setEntry = useCallback((id: string, next: Omit<FABEntry, 'id'> | null) => {
    if (next) {
      ownerRef.current = id;
      setEntryState({ id, ...next });
      return;
    }
    // Release : seul l'owner peut vider la slot.
    if (ownerRef.current === id) {
      ownerRef.current = null;
      setEntryState(null);
    }
  }, []);

  const ctx = useMemo<FABContextValue>(() => ({ setEntry }), [setEntry]);

  return (
    <FABContext.Provider value={ctx}>
      {children}
      <FABRenderer entry={entry} />
    </FABContext.Provider>
  );
}

/**
 * Hook publié par chaque page pour déclarer son action FAB.
 *
 * - Passer `null` (ou rien) ⇒ pas de FAB sur cette page.
 * - onClick est routé via une ref → recréer la fonction à chaque render
 *   n'invalide pas l'effet, donc pas de cleanup/register en boucle.
 * - Les changements de Icon / label / pulse déclenchent une mise à jour
 *   propre de la slot via setEntry (idempotent).
 */
export function useFAB(action: FABAction | null) {
  const ctx = useContext(FABContext);
  const id = useId();

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

function FABRenderer({ entry }: { entry: FABEntry | null }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>{entry && <FABButton key="fab" entry={entry} />}</AnimatePresence>,
    document.body,
  );
}

function FABButton({ entry }: { entry: FABEntry }) {
  const { Icon = Plus, label, pulse = false, onClickRef } = entry;
  // Clé du contenu interne : change quand l'icône/label change → AnimatePresence
  // déclenche un morph propre quand on passe d'une page à l'autre.
  const contentKey = `${Icon.displayName ?? Icon.name ?? 'icon'}-${label ?? ''}`;

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
      className={`shine flex items-center justify-center h-14 px-5 rounded-full text-[#1a0d00] font-display font-black text-sm uppercase tracking-wider tap-transparent border border-gold/60 overflow-hidden ${
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
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={contentKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 relative z-10 whitespace-nowrap"
        >
          <Icon className="w-5 h-5" strokeWidth={3} />
          {label && <span>{label}</span>}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
