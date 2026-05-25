import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface FlashState {
  message: string | null;
  kind: 'info' | 'error';
}

interface FlashContextValue {
  flash: FlashState;
  show: (message: string, kind?: 'info' | 'error') => void;
  clear: () => void;
}

const FlashContext = createContext<FlashContextValue | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<FlashState>({ message: null, kind: 'info' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setFlash({ message: null, kind: 'info' });
  }, []);

  const show = useCallback(
    (message: string, kind: 'info' | 'error' = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setFlash({ message, kind });
      timer.current = setTimeout(() => {
        setFlash({ message: null, kind: 'info' });
        timer.current = null;
      }, 3000);
    },
    [],
  );

  const value = useMemo(() => ({ flash, show, clear }), [flash, show, clear]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function useFlash(): FlashContextValue {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error('useFlash must be used within <FlashProvider>');
  return ctx;
}
