import { Button } from './Button';
import { useAuth } from '../hooks/useAuth';

interface StagingGateProps {
  /** Login de l'utilisateur connecté (non-superadmin). */
  login: string | null;
}

/**
 * Écran-barrière du staging : `staging.oneleague.fr` est réservé aux superadmins.
 * Affiché en plein écran quand un utilisateur authentifié N'EST PAS superadmin.
 *
 * Ce n'est pas qu'un masque visuel : le backend l'impose aussi (APP_ENV=staging,
 * cf. la staging-gate dans apps/backend/src/index.ts), donc un appel API direct
 * d'un non-superadmin est refusé (401/403).
 */
export function StagingGate({ login }: StagingGateProps) {
  const { signOut } = useAuth();

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="relative card-hud border-gold/40 rounded-2xl p-6 w-full max-w-md animate-pop text-center"
        style={{
          boxShadow:
            '0 18px 48px rgba(0,0,0,0.7), 0 0 40px rgba(255,201,74,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="text-4xl mb-3">🔒</div>
        <div className="font-gaming text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold mb-2">
          Environnement de staging
        </div>
        <h2 className="text-lg font-bold text-text-strong mb-2">
          Accès réservé aux superadmins
        </h2>
        <p className="text-[12px] text-muted-2 leading-relaxed mb-5">
          {login ? (
            <>
              Salut <span className="font-semibold text-text-strong">{login}</span> —{' '}
            </>
          ) : null}
          cet environnement de test n’est ouvert qu’aux superadmins. Pour jouer,
          rends-toi sur{' '}
          <a href="https://oneleague.fr" className="text-gold underline">
            oneleague.fr
          </a>
          .
        </p>
        <Button variant="ghost" size="md" full onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
      </div>
    </div>
  );
}
