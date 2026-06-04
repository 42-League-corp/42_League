import { useState } from 'react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { api } from '../lib/api';
import { IS_STAGING } from '../lib/config';
import { getImpersonatorLogin, startImpersonation, stopImpersonation } from '../lib/storage';

// ─────────────────────────────────────────────────────────────────────────────
// Bouton flottant « Tester en mode user » — STAGING + admins UNIQUEMENT.
//
// Permet à un admin/superadmin de basculer sur le compte générique `tester`
// (rôle USER) pour vivre l'expérience d'un joueur lambda, puis de revenir à son
// compte. Le token de l'admin est sauvegardé côté client (startImpersonation) ;
// le retour (stopImpersonation) le restaure sans repasser par OAuth.
//
// Le serveur ne délivre QUE le token du compte `tester` dédié, jamais celui d'un
// joueur réel (cf. POST /admin/impersonate-tester) — staging only, fail-secure.
// ─────────────────────────────────────────────────────────────────────────────
export function TesterSwitch() {
  const { me } = useLeagueData();
  const { show } = useFlash();
  const [busy, setBusy] = useState(false);
  // Lu une seule fois au montage : on recharge la page à chaque bascule, donc
  // pas besoin de réactivité sur le localStorage.
  const [impersonator] = useState(() => getImpersonatorLogin());

  const isAdmin = me?.role === 'ADMIN' || me?.role === 'SUPERADMIN';

  async function handleSwitch() {
    setBusy(true);
    try {
      const { token, login } = await api.impersonateTester();
      startImpersonation(token, login);
      // Rechargement complet → tout l'état (session, /me, SSE) repart sur tester.
      window.location.assign('/');
    } catch (err) {
      setBusy(false);
      show(err instanceof Error ? err.message : 'Bascule impossible', 'error');
    }
  }

  function handleReturn() {
    if (stopImpersonation()) {
      window.location.assign('/');
    }
  }

  // Impersonation en cours → bannière de retour (visible quel que soit le rôle).
  if (impersonator) {
    return (
      <button
        onClick={handleReturn}
        className="fixed z-[80] bottom-36 sm:bottom-24 left-3 flex items-center gap-2 px-4 py-2.5 rounded-full border border-gold/60 bg-gold/15 glass-strong shadow-lg hover:bg-gold/25 transition-colors animate-pop"
        title={`Revenir au compte ${impersonator}`}
      >
        <span className="text-base">🧪</span>
        <span className="text-left leading-tight">
          <span className="block text-[10px] uppercase tracking-wider text-gold font-bold">
            Mode test (tester)
          </span>
          <span className="block text-xs text-text-strong font-semibold">
            Revenir à {impersonator} →
          </span>
        </span>
      </button>
    );
  }

  // Sinon : bouton de bascule, réservé aux admins sur staging.
  if (!IS_STAGING || !isAdmin) return null;

  return (
    <button
      onClick={handleSwitch}
      disabled={busy}
      className="fixed z-[80] bottom-36 sm:bottom-24 left-3 flex items-center gap-2 px-4 py-2.5 rounded-full border border-teal/50 bg-teal-deep/20 glass-strong shadow-lg hover:bg-teal-deep/30 transition-colors disabled:opacity-50 animate-pop"
      title="Basculer sur le compte tester (mode utilisateur)"
    >
      <span className="text-base">🧪</span>
      <span className="text-xs font-semibold text-teal">
        {busy ? 'Bascule…' : 'Tester en mode user'}
      </span>
    </button>
  );
}
