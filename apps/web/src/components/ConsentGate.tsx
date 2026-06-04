import { useState } from 'react';
import { Button } from './Button';
import { api, AuthError } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface ConsentGateProps {
  /** Login de l'utilisateur (affiché pour personnaliser l'accueil). */
  login: string | null;
  /** Appelé après acceptation enregistrée côté serveur → recharge les données. */
  onAccepted: () => void;
}

/**
 * Écran-barrière de consentement RGPD (CGU API 42, Art. 3.1 & 4.2).
 *
 * Affiché en plein écran au premier login (ou après évolution de la politique),
 * AVANT tout accès à l'app. Le consentement est aussi exigé côté serveur
 * (consent-gate dans le backend) : cette modale ne peut donc pas être contournée.
 *
 * UX : ton rassurant, transparent et minimal — on dit exactement ce qu'on collecte,
 * pourquoi, et on rappelle que tout est exportable/supprimable à tout moment.
 */
export function ConsentGate({ login, onAccepted }: ConsentGateProps) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState<null | 'accept' | 'refuse'>(null);
  const [confirmRefuse, setConfirmRefuse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy('accept');
    setError(null);
    try {
      await api.consent(true);
      onAccepted();
    } catch (e) {
      if (e instanceof AuthError) {
        signOut();
        return;
      }
      setError('Impossible d’enregistrer ton choix. Réessaie.');
      setBusy(null);
    }
  }

  async function refuse() {
    setBusy('refuse');
    setError(null);
    try {
      await api.consent(false);
    } catch {
      // Même en cas d'erreur réseau, on déconnecte : aucun accès sans consentement.
    } finally {
      signOut();
      // Retour à l'intra : l'utilisateur a refusé, ses données ont été supprimées.
      window.location.href = 'https://intra.42.fr';
    }
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="flex min-h-full items-center justify-center p-4">
      <div
        className="relative card-hud border-gold/40 rounded-2xl p-5 sm:p-6 w-full max-w-md animate-pop overflow-hidden"
        style={{
          boxShadow:
            '0 18px 48px rgba(0,0,0,0.7), 0 0 40px rgba(255,201,74,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Filigrane doré */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at top, rgba(255,201,74,0.12) 0%, transparent 60%)',
          }}
        />

        {/* Titre */}
        <div className="relative mb-4">
          <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-gold rounded-sm" />
            Bienvenue sur 42 League
          </div>
          <div className="text-[11px] text-muted-2">
            {login ? (
              <>Salut <span className="font-semibold text-text-strong">{login}</span> — avant de jouer, un point rapide sur tes données.</>
            ) : (
              <>Avant de jouer, un point rapide sur tes données.</>
            )}
          </div>
        </div>

        {/* Ce qu'on conserve */}
        <div className="relative mb-3 bg-bg-2/40 border border-border rounded-lg px-3 py-3 text-[11px] leading-relaxed text-muted-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-extrabold mb-2">
            Ce que 42 League conserve
          </div>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <span className="text-gold">•</span>
              <span>Ton <strong className="text-text-strong">login, campus et photo</strong> — récupérés via l’API de l’intra 42.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold">•</span>
              <span>Ton <strong className="text-text-strong">historique de matchs, défis et tournois</strong> — pour calculer ton ELO et le classement.</span>
            </li>
          </ul>
        </div>

        {/* Réassurance */}
        <div className="relative mb-4 bg-gold/[0.06] border border-gold/25 rounded-lg px-3 py-2.5 text-[11px] text-[#ffe6a8] leading-relaxed">
          🔒 Tes données restent <strong>dans le réseau 42</strong>, ne sont jamais revendues ni partagées.
          Tu peux les <strong>exporter ou tout supprimer</strong> à tout moment depuis <em>Réglages › Confidentialité</em>.
        </div>

        {error && (
          <div className="relative mb-3 text-[11px] text-red bg-red/10 border border-red/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Actions */}
        {!confirmRefuse ? (
          <div className="relative flex flex-col gap-2">
            <Button
              variant="gold"
              size="lg"
              full
              loading={busy === 'accept'}
              disabled={busy !== null}
              onClick={accept}
            >
              Accepter et continuer
            </Button>
            <button
              onClick={() => setConfirmRefuse(true)}
              disabled={busy !== null}
              className="text-[11px] text-muted hover:text-red transition-colors py-1 disabled:opacity-40"
            >
              Refuser et supprimer mes données
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="mb-3 text-[11px] text-[#ffb3bf] bg-red/[0.08] border border-red/30 rounded-lg px-3 py-2.5 leading-relaxed">
              ⚠ En refusant, ton compte et tes données sont <strong>supprimés</strong> et tu ne pourras pas utiliser 42 League. Confirmer ?
            </div>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="md"
                loading={busy === 'refuse'}
                disabled={busy !== null}
                onClick={refuse}
                className="flex-1"
              >
                Oui, supprimer et quitter
              </Button>
              <Button
                variant="ghost"
                size="md"
                disabled={busy !== null}
                onClick={() => setConfirmRefuse(false)}
              >
                Revenir
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
