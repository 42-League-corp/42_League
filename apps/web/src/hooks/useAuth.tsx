import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { logout as doLogout, redirectToLogin } from '../lib/auth';
import { getStoredLogin, getToken } from '../lib/storage';

interface AuthContextValue {
  authenticated: boolean;
  login: string | null;
  startLogin: () => void;
  signOut: () => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): { authenticated: boolean; login: string | null } {
  const token = getToken();
  if (!token) return { authenticated: false, login: null };
  return { authenticated: true, login: getStoredLogin() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key.startsWith('league:')) {
        setSession(readSession());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const startLogin = useCallback(() => redirectToLogin(), []);

  const signOut = useCallback(() => {
    doLogout();
    setSession({ authenticated: false, login: null });
  }, []);

  const refreshSession = useCallback(() => {
    setSession(readSession());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...session, startLogin, signOut, refreshSession }),
    [session, startLogin, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
