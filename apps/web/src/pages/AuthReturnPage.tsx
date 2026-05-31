import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { consumeAuthReturn } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';

export function AuthReturnPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = consumeAuthReturn();
    if (result.ok) {
      refreshSession();
      navigate('/challenges', { replace: true });
      return;
    }
    setError(result.error);
  }, [navigate, refreshSession]);

  if (!error) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-2 gap-3">
        <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
        <span className="font-gaming uppercase tracking-[0.18em] text-gold text-sm font-bold">
          Connexion…
        </span>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full card-hud border-red/45 rounded-2xl p-6 text-center">
        <div className="font-gaming text-red text-xs uppercase tracking-[0.18em] font-extrabold mb-3 flex items-center justify-center gap-2">
          <span className="inline-block w-1 h-3 bg-red rounded-sm" />
          ⛔ Connexion refusée
        </div>
        <p className="text-sm text-text">{error}</p>
        <div className="mt-6">
          <Link to="/login">
            <Button variant="ghost">Retour</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
