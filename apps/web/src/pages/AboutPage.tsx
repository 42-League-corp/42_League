import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, BookOpen, Shield } from 'lucide-react';
import { Panel } from '../components/Panel';
import { useT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';

type Tab = 'rules' | 'privacy';

export function AboutPage() {
  const t = useT();
  const { authenticated } = useAuth();
  const [tab, setTab] = useState<Tab>('rules');

  const inner = (
    <>
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-2/60 border border-border/40 mb-5">
        <TabBtn active={tab === 'rules'} onClick={() => setTab('rules')} Icon={BookOpen}>
          {t('about.rules.title')}
        </TabBtn>
        <TabBtn active={tab === 'privacy'} onClick={() => setTab('privacy')} Icon={Shield}>
          {t('about.privacy.title')}
        </TabBtn>
      </div>

      {tab === 'rules' ? <RulesSection /> : <PrivacySection />}
    </>
  );

  // Non authentifié : page autonome (hors shell). Conteneur scrollable plein écran
  // + bouton retour vers la connexion (parcours RGPD avant login).
  if (!authenticated) {
    return (
      <div className="h-full overflow-y-auto overscroll-contain scrollbar-none">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="mb-5">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-muted-2 hover:text-gold transition-colors text-xs font-semibold uppercase tracking-[0.14em]"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
              Connexion
            </Link>
          </div>
          {inner}
        </div>
      </div>
    );
  }

  // Authentifié : rendu à l'intérieur du shell (header + scroll <main> + tab bar).
  // On s'appuie sur le scroll du shell — pas de conteneur scrollable imbriqué.
  return <div className="w-full">{inner}</div>;
}

function TabBtn({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-extrabold uppercase tracking-[0.14em] transition-all duration-150 ${
        active
          ? 'bg-gold/10 border border-gold/30 text-gold shadow-[inset_0_1px_0_rgba(255,215,120,0.12)]'
          : 'text-muted-2 hover:text-text'
      }`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      {children}
    </button>
  );
}

// ─── Règles du jeu ────────────────────────────────────────────────────────────

function RulesSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <Panel title="Format du match">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            42 League est un classement ELO de <span className="text-text font-semibold">babyfoot 1 contre 1</span>.
            Chaque joueur inscrit peut défier n'importe quel autre membre de sa league.
          </p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            <li>Match en <span className="text-gold font-semibold">10 buts</span> — premier arrivé à 10 gagne.</li>
            <li>Un match ne peut être déclaré qu'<span className="text-text font-semibold">après avoir été joué</span>.</li>
            <li>Les deux joueurs déclarent leur score indépendamment. En cas de désaccord, le match est annulé.</li>
          </ul>
        </div>
      </Panel>

      <div className="md:col-span-2">
        <Panel title="Règles sur le terrain">
          <div className="space-y-3 text-sm text-muted leading-relaxed">
            <p>
              Conventions de jeu pour qu'un but soit valable et que les matchs restent disputés
              proprement :
            </p>
            <ul className="space-y-1.5 pl-3 border-l border-gold/25">
              <li>
                Après l'engagement (<span className="text-text font-semibold">kick-off</span>), la balle doit
                être <span className="text-gold font-semibold">touchée au moins une fois</span> avant qu'un but
                ne compte.
              </li>
              <li>
                Le joueur qui <span className="text-text font-semibold">vient d'encaisser un but</span> a le droit
                de remettre la balle <span className="text-gold font-semibold">au pied de sa barre du milieu</span> (demis)
                pour relancer.
              </li>
              <li>
                Les <span className="text-gold font-semibold">buts marqués depuis la barre du milieu</span> (demis)
                sont valables.
              </li>
              <li>
                La <span className="text-gold font-semibold">gamelle</span> (balle qui ressort du but) : tu peux
                soit <span className="text-text font-semibold">prendre le point</span>, soit
                <span className="text-text font-semibold"> retirer un point à l'adversaire</span> — mais on ne peut
                <span className="text-text font-semibold"> pas conclure le match sur une gamelle</span>.
              </li>
              <li>
                Les <span className="text-gold font-semibold">roulettes</span> doivent être
                <span className="text-text font-semibold"> contrôlées</span> (pas de moulinets incontrôlés).
              </li>
            </ul>
          </div>
        </Panel>
      </div>

      <Panel title="ELO">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Le classement utilise un système <span className="text-gold font-semibold">ELO dérivé des échecs</span>,
            adapté au babyfoot.
          </p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            <li>Score de départ : <span className="text-text font-semibold">1000 ELO</span>.</li>
            <li>Battre un adversaire mieux classé rapporte plus de points.</li>
            <li>Seul le <span className="text-text font-semibold">premier match entre deux mêmes joueurs dans un délai de 3 jours</span> est comptabilisé pour l'ELO — évite le farming.</li>
          </ul>
        </div>
      </Panel>

      <Panel title="Défis et OPS">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Les <span className="text-gold font-semibold">défis</span> permettent de planifier un match à une heure précise.
            L'adversaire accepte ou décline.
          </p>
          <p>
            Les <span className="text-gold font-semibold">OPS</span> (opérations) sont des gels de classement :
            un joueur peut cibler un adversaire et bloquer ses points ELO pendant 7 jours. Un seul OPS actif à la fois,
            avec 7 jours de cooldown après expiration.
          </p>
        </div>
      </Panel>

      <Panel title="Tournois">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Les tournois sont en format <span className="text-text font-semibold">élimination directe</span> (4 ou 8 joueurs).
            Les tournois <span className="text-gold font-semibold">officiels</span> sont créés par les admins et
            peuvent affecter le classement. Les tournois <span className="text-text font-semibold">amicaux</span>
            sont ouverts à tous et n'ont pas d'impact ELO.
          </p>
        </div>
      </Panel>
    </div>
  );
}

// ─── Politique de confidentialité ─────────────────────────────────────────────

function PrivacySection() {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Responsable du traitement">
        <p className="text-sm text-muted leading-relaxed">
          Cette application est développée et opérée par des étudiants du réseau 42 dans le cadre
          des CGU de l'API 42 (
          <a
            href="https://api.intra.42.fr/apidoc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            api.intra.42.fr
          </a>
          ). Pour toute question relative à vos données :{' '}
          <a href="mailto:abidaux@student.42lehavre.fr" className="text-gold hover:underline">
            abidaux@student.42lehavre.fr
          </a>
        </p>
      </Panel>

      <Panel title="Données collectées">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>Les données suivantes sont traitées dans l'application :</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-1.5 pr-3 text-muted-2 font-bold uppercase tracking-wider">Donnée</th>
                <th className="text-left py-1.5 pr-3 text-muted-2 font-bold uppercase tracking-wider">Source</th>
                <th className="text-left py-1.5 text-muted-2 font-bold uppercase tracking-wider">Conservation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              <tr>
                <td className="py-1.5 pr-3 text-text">Login, campus, photo</td>
                <td className="py-1.5 pr-3 text-muted">API 42 (OAuth)</td>
                <td className="py-1.5 text-muted">Jusqu'à suppression</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-text">Historique de matchs</td>
                <td className="py-1.5 pr-3 text-muted">Actions utilisateur</td>
                <td className="py-1.5 text-muted">Durée de la saison</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-text">Cookie de session</td>
                <td className="py-1.5 pr-3 text-muted">Technique (auth)</td>
                <td className="py-1.5 text-muted">30 jours</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-text">Logs d'administration</td>
                <td className="py-1.5 pr-3 text-muted">Actions admin</td>
                <td className="py-1.5 text-muted">24 mois</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Base légale">
        <p className="text-sm text-muted leading-relaxed">
          Le traitement est fondé sur l'<span className="text-text font-semibold">intérêt légitime</span> (RGPD Art. 6(1)(f)) :
          gestion d'un classement sportif au sein du réseau 42, dans le cadre pédagogique défini
          par les CGU de l'API 42. L'accès à vos données de profil 42 est conditionné à votre
          consentement explicite lors de la connexion OAuth.
        </p>
      </Panel>

      <Panel title="Vos droits">
        <div className="space-y-2 text-sm text-muted leading-relaxed">
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            <li>
              <span className="text-text font-semibold">Accès et portabilité</span> — export JSON disponible
              dans <Link to="/settings" className="text-gold hover:underline">Réglages</Link>.
            </li>
            <li>
              <span className="text-text font-semibold">Effacement</span> — suppression (anonymisation)
              du compte disponible dans <Link to="/settings" className="text-gold hover:underline">Réglages</Link>.
            </li>
            <li>
              <span className="text-text font-semibold">Rectification</span> — contactez-nous par email.
            </li>
            <li>
              <span className="text-text font-semibold">Opposition</span> — vous pouvez cesser d'utiliser l'application
              à tout moment et demander la suppression de votre compte.
            </li>
          </ul>
          <p className="text-xs text-muted-2 pt-1">
            Autorité de contrôle : CNIL —{' '}
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              cnil.fr
            </a>
          </p>
        </div>
      </Panel>

      <Panel title="Sécurité">
        <p className="text-sm text-muted leading-relaxed">
          Les communications sont chiffrées en transit (HTTPS). Les tokens de session
          sont signés cryptographiquement (HMAC-SHA256) et transmis exclusivement
          via cookies <code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">HttpOnly</code> ou
          fragment d'URL (non loggués). Aucune donnée n'est partagée avec des tiers,
          à l'exception du webhook Discord interne utilisé pour les alertes admin
          (sans données personnelles).
        </p>
      </Panel>
    </div>
  );
}
