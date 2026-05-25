import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { consumeAuthReturn } from '../lib/auth';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';

export function AuthReturnPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  useEffect(() => {
    const result = consumeAuthReturn();
    if (result.ok) {
      refreshSession();
      navigate('/defis', { replace: true });
      return;
    }
    setError(result.error);
    setErrorLogin(result.login);
  }, [navigate, refreshSession]);

  if (!error) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-2">
        Connexion…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-bg-1/70 border border-red/40 rounded-lg p-6 text-center">
        <div className="text-red text-xs uppercase tracking-[0.18em] font-extrabold mb-3">
          ⛔ Connexion refusée
        </div>
        {error === 'not_whitelisted' ? (
          <p className="text-sm text-text leading-relaxed">
            Le compte{' '}
            <code className="bg-bg-2 px-1.5 py-0.5 rounded text-teal text-xs">
              {errorLogin}
            </code>{' '}
            n'est pas autorisé sur cette instance 42 League.
            <br />
            Demande à l'admin de t'ajouter à la whitelist.
          </p>
        ) : (
          <p className="text-sm text-text">{error}</p>
        )}
        <div className="mt-6">
          <Link to="/login">
            <Button variant="ghost">Retour</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
