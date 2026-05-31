import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Shield, Terminal, Users, Crown } from 'lucide-react';
import { Panel } from '../components/Panel';
import { useT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { useLeagueData } from '../hooks/useLeagueData';

type Tab = 'rules' | 'privacy' | 'tech' | 'team';

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
        <TabBtn active={tab === 'tech'} onClick={() => setTab('tech')} Icon={Terminal}>
          {t('about.tech.title')}
        </TabBtn>
        <TabBtn active={tab === 'team'} onClick={() => setTab('team')} Icon={Users}>
          Équipe
        </TabBtn>
      </div>

      {tab === 'rules' ? (
        <RulesSection />
      ) : tab === 'privacy' ? (
        <PrivacySection />
      ) : tab === 'tech' ? (
        <TechSection />
      ) : (
        <TeamSection />
      )}
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
      className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.1em] leading-tight transition-all duration-150 ${
        active
          ? 'bg-gold/10 border border-gold/30 text-gold shadow-[inset_0_1px_0_rgba(255,215,120,0.12)]'
          : 'text-muted-2 hover:text-text'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
      {children}
    </button>
  );
}

// ─── Règles du jeu ────────────────────────────────────────────────────────────

function RulesSection() {
  return (
    <div className="flex flex-col gap-4">
      {/* En tête, pleine largeur : les règles de jeu sur le terrain. */}
      <Panel title="Règles sur le terrain" accent="book">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Conventions de jeu pour qu'un but soit valable et que les matchs restent disputés
            proprement :
          </p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            <li>
              Après l'engagement (<span className="text-text font-semibold">kick-off</span>), la balle doit
              être <span className="text-gold font-semibold">touchée au moins deux fois</span> avant qu'un but
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

      {/* Le système ELO en pleine largeur : la formule détaillée mérite l'espace. */}
      <EloSection />

      {/* Rangée régulière de 3 panneaux « méta », hauteurs égales. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
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

      <Panel title="Défis et OPS">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Les <span className="text-gold font-semibold">défis</span> permettent de planifier un match à une heure précise.
            L'adversaire accepte ou décline.
          </p>
          <p>
            Un <span className="text-red font-semibold">OPS</span> (opération) désigne ton{' '}
            <span className="text-text font-semibold">ennemi juré</span> : tu cibles un joueur et la traque
            s'ouvre. Action unilatérale, aucune acceptation requise.
          </p>
          <ul className="space-y-1.5 pl-3 border-l border-red/30">
            <li>La traque dure <span className="text-text font-semibold">24 heures</span>.</li>
            <li>
              Pendant ce temps, la cible <span className="text-text font-semibold">ne peut pas refuser</span> les
              <span className="text-text font-semibold"> 3 premiers défis</span> de son traqueur — elle doit les jouer.
            </li>
            <li>
              Refuser un de ces matchs forcés coûte <span className="text-red font-semibold">3× l'ELO d'une défaite</span>
              {' '}(bien plus qu'un simple désistement).
            </li>
            <li>Un seul OPS actif à la fois, avec un cooldown d'une semaine après expiration.</li>
          </ul>
        </div>
      </Panel>

      <Panel title="Tournois">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Les tournois sont en format <span className="text-text font-semibold">élimination directe</span> (8 ou 16 joueurs).
            Les tournois <span className="text-gold font-semibold">officiels</span> sont créés par les admins et
            peuvent affecter le classement. Les tournois <span className="text-text font-semibold">amicaux</span>
            sont ouverts à tous et n'ont pas d'impact ELO.
          </p>
        </div>
      </Panel>
      </div>
    </div>
  );
}

// ─── Système ELO ──────────────────────────────────────────────────────────────

/**
 * Détail de la formule ELO réellement appliquée côté serveur
 * (cf. packages/shared/src/elo.ts). Présentation pédagogique, en pleine largeur.
 */
function EloSection() {
  return (
    <Panel title="Système ELO" sub="comment les points sont calculés">
      <div className="space-y-5 text-sm text-muted leading-relaxed">
        <p>
          Le classement repose sur un système <span className="text-gold font-semibold">ELO dérivé des échecs</span>,
          adapté au babyfoot 1 contre 1. Chaque joueur démarre à{' '}
          <span className="text-text font-semibold">1000 points</span>. À chaque match, des points sont
          transférés du perdant vers le gagnant — d'autant plus que le résultat était{' '}
          <span className="text-text font-semibold">inattendu</span> et la victoire{' '}
          <span className="text-text font-semibold">large</span>.
        </p>

        {/* La formule mise en avant */}
        <div className="rounded-xl border border-gold/25 bg-bg-2/50 p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-2 mb-3">
            Points transférés
          </div>
          <div className="font-gaming text-center text-base sm:text-lg text-text-strong tracking-wide">
            <span className="text-gold">K</span> × <span className="text-gold">M</span> ×{' '}
            <span className="text-text">(1 − E)</span>
            <span className="text-muted"> + </span>
            <span className="text-gold">bonus d'upset</span>
          </div>
        </div>

        {/* Décomposition terme par terme */}
        <div className="space-y-3">
          <EloTerm symbol="E" label="Probabilité attendue">
            La chance théorique de victoire du gagnant, calculée à partir de l'écart de classement
            (<code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">1 / (1 + 10^((Elo_perdant − Elo_gagnant) / 400))</code>).
            Battre un adversaire mieux classé rapporte plus, car la victoire était peu probable.
          </EloTerm>
          <EloTerm symbol="K = 32" label="Facteur de base">
            La quantité maximale de points en jeu sur un match « neutre ». Plus il est élevé, plus le
            classement réagit vite.
          </EloTerm>
          <EloTerm symbol="M" label="Multiplicateur d'écart de buts">
            <code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">1 + (10 − score_perdant) × 0,1</code> :
            gagner <span className="text-text font-semibold">10–0</span> pèse davantage qu'un{' '}
            <span className="text-text font-semibold">10–9</span> serré. L'ampleur de la victoire compte.
          </EloTerm>
          <EloTerm symbol="Bonus d'upset" label="Récompense l'exploit">
            En clair :{' '}
            <span className="text-text font-semibold">
              si tu bats quelqu'un de bien mieux classé que toi, tu gagnes beaucoup plus de points
            </span>{' '}
            — et lui en perd d'autant. Battre un adversaire de niveau proche ne rapporte que peu :
            plus l'écart de classement est grand, plus l'exploit paie.
          </EloTerm>
        </div>

        {/* Exemple chiffré : à score égal, seul l'écart de classement change le gain. */}
        <div className="rounded-xl border border-gold/20 bg-bg-2/40 overflow-hidden">
          <div className="px-4 py-2.5 bg-bg-2/60 border-b border-gold/15 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-2">
            Exemple — tu es à 1000 ELO et tu gagnes 10–5
          </div>
          <div className="divide-y divide-border/20">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Petit écart</div>
                <div className="text-xs text-muted-2">tu bats un joueur à 1050 ELO</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums text-sm">
                <span className="text-[#7fd66e] font-extrabold">+29</span>
                <span className="text-muted-2 text-[11px]">/ il perd</span>
                <span className="text-red font-extrabold">−29</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Gros écart</div>
                <div className="text-xs text-muted-2">tu bats un joueur à 1400 ELO</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums text-sm">
                <span className="text-[#7fd66e] font-extrabold">+60</span>
                <span className="text-muted-2 text-[11px]">/ il perd</span>
                <span className="text-red font-extrabold">−60</span>
              </div>
            </div>
          </div>
          <div className="px-4 py-2.5 text-xs text-muted leading-relaxed border-t border-gold/15">
            Même score, même victoire : l'exploit face au joueur à +400 d'écart rapporte{' '}
            <span className="text-text font-semibold">deux fois plus de points</span>.
          </div>
        </div>

        {/* Garde-fous & règles annexes */}
        <ul className="space-y-1.5 pl-3 border-l border-gold/25">
          <li>
            <span className="text-text font-semibold">Asymétrie sur les gros upsets</span> — le perdant surcoté encaisse
            tout le bonus (jusqu'à <span className="text-gold font-semibold">−400</span> sur un match), mais le gagnant
            ne grimpe que d'une part <span className="text-text font-semibold">plafonnée à +50</span> : battre un seul
            « boss » gonflé ne fait pas exploser ton propre rating.
          </li>
          <li>
            <span className="text-text font-semibold">Garde-fou</span> — la variation est bornée à{' '}
            <span className="text-gold font-semibold">±400 points</span> par match.
          </li>
          <li>
            <span className="text-text font-semibold">Anti-farming</span> — seul le{' '}
            <span className="text-text font-semibold">premier match entre deux mêmes joueurs sur une fenêtre de 3 jours</span>{' '}
            compte pour l'ELO.
          </li>
        </ul>
      </div>
    </Panel>
  );
}

function EloTerm({
  symbol,
  label,
  children,
}: {
  symbol: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-24 sm:w-28 pt-0.5">
        <div className="font-gaming text-sm font-extrabold text-gold leading-tight">{symbol}</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-2 mt-0.5">{label}</div>
      </div>
      <p className="flex-1 text-sm text-muted leading-relaxed">{children}</p>
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

// ─── Coulisses techniques ─────────────────────────────────────────────────────

/**
 * Parenthèse « sous le capot » : un site utilisé par 42, autant en exposer le
 * fonctionnement. Volontairement court et synthétique, dans le ton du reste.
 */
function TechSection() {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Architecture">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Monorepo <span className="text-text font-semibold">TypeScript</span> de bout en bout, en trois morceaux :
          </p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            <li>
              <span className="text-gold font-semibold">Front</span> — React 18 + Vite, installable en{' '}
              <span className="text-text font-semibold">PWA</span> (service worker, plein écran sur mobile).
            </li>
            <li>
              <span className="text-gold font-semibold">Back</span> — API <span className="text-text font-semibold">Hono</span>{' '}
              sur Node, base <span className="text-text font-semibold">PostgreSQL</span> via Prisma. Connexion 42 en OAuth.
            </li>
            <li>
              <span className="text-gold font-semibold">Temps réel</span> — le serveur pousse les changements en{' '}
              <code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">SSE</code> ; le classement, les défis et les OPS
              se mettent à jour <span className="text-text font-semibold">sans rechargement</span>.
            </li>
          </ul>
        </div>
      </Panel>

      <Panel title="Hébergement & déploiement">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Le site tourne sur un serveur <span className="text-gold font-semibold">Scaleway</span>, derrière un reverse-proxy{' '}
            <span className="text-text font-semibold">Caddy</span> qui gère le <span className="text-text font-semibold">TLS</span>{' '}
            automatiquement (Let's Encrypt).
          </p>
          <p>
            Chaque <code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">push</code> sur la branche principale
            déclenche une <span className="text-gold font-semibold">GitHub Action</span> : elle construit une{' '}
            <span className="text-text font-semibold">image Docker</span>, la scanne (Trivy) puis la pousse sur le serveur, qui
            redémarre sur la nouvelle version. <span className="text-text font-semibold">Zéro déploiement manuel.</span>
          </p>
        </div>
      </Panel>

      <Panel title="Friendly hack" sub="la transparence est volontaire">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>
            Détailler la stack ici, c'est assumé : un site fait <span className="text-text font-semibold">par</span> et{' '}
            <span className="text-text font-semibold">pour</span> 42 mérite d'être curieux de l'intérieur. Le code applicatif
            reste en dépôt <span className="text-gold font-semibold">privé</span>, mais le fonctionnement n'a rien d'un secret.
          </p>
          <p>
            Tu trouves une faille, un comportement louche, une idée de contournement ? <span className="text-gold font-semibold">Préviens
            plutôt que d'exploiter</span> — divulgation responsable à{' '}
            <a href="mailto:abidaux@student.42lehavre.fr" className="text-gold hover:underline">
              abidaux@student.42lehavre.fr
            </a>
            . Les bons reports finissent crédités. 🏴‍☠️
          </p>
        </div>
      </Panel>
    </div>
  );
}

// ─── Équipe & développeurs ────────────────────────────────────────────────────

/**
 * Les personnes derrière 42 League — de l'idée au déploiement. Chaque membre a
 * un rôle distinct dans l'histoire du projet ; l'ordre suit cette chronologie :
 * l'idée, le passage 0 → 1, l'ambition, puis l'accompagnement (bêta & infra).
 */
type Member = {
  login: string;
  role: string;
  accent: 'gold' | 'red';
  crown?: boolean;
  blurb: React.ReactNode;
};

const TEAM: Member[] = [
  {
    login: 'nithomas',
    role: 'Parrain',
    accent: 'gold',
    blurb: (
      <>
        À l'origine de tout : c'est lui qui a soufflé{' '}
        <span className="text-text font-semibold">l'idée initiale</span>. Sans cette première étincelle,
        42 League n'existerait pas.
      </>
    ),
  },
  {
    login: 'throbert',
    role: 'Founder',
    accent: 'gold',
    crown: true,
    blurb: (
      <>
        À l'origine du concept concret : un{' '}
        <span className="text-text font-semibold">classement ELO de babyfoot 1v1</span> du campus,
        avec <span className="text-text font-semibold">défis programmés</span>, OPS,{' '}
        <span className="text-text font-semibold">tournois</span> à élimination directe et{' '}
        <span className="text-text font-semibold">trophées</span> — le tout réuni dans une seule app.
      </>
    ),
  },
  {
    login: 'abidaux',
    role: 'Cofondateur',
    accent: 'gold',
    blurb: (
      <>
        A <span className="text-text font-semibold">boosté le projet</span> et lui a donné une tout
        autre dimension : bien <span className="text-text font-semibold">plus d'ambition</span>, une
        vision qui voit plus grand et plus loin.
      </>
    ),
  },
  {
    login: 'jagharra',
    role: 'Conseiller · Bêta-test',
    accent: 'red',
    blurb: (
      <>
        <span className="text-text font-semibold">Conseiller</span> et{' '}
        <span className="text-text font-semibold">bêta-testeur</span> : retours du terrain et chasse
        aux aspérités pendant toute la phase de bêta.
      </>
    ),
  },
  {
    login: 'sbonneaux',
    role: 'Conseiller · Déploiement & hébergement',
    accent: 'red',
    blurb: (
      <>
        <span className="text-text font-semibold">Conseiller</span> sur tout le volet{' '}
        <span className="text-text font-semibold">déploiement et hébergement</span> : infrastructure,
        mise en ligne et bonnes pratiques de prod.
      </>
    ),
  },
];

// La page « À propos » est accessible avant connexion (parcours RGPD) — là, le
// contexte LeagueData n'existe pas. On ne lit les photos intra que connecté.
function TeamSection() {
  const { authenticated } = useAuth();
  return authenticated ? <TeamSectionAuthed /> : <TeamCarousel photos={{}} />;
}

function TeamSectionAuthed() {
  const { leaderboard } = useLeagueData();
  const photos: Record<string, string | null> = {};
  for (const u of leaderboard) photos[u.login] = u.imageUrl;
  return <TeamCarousel photos={photos} />;
}

function TeamCarousel({ photos }: { photos: Record<string, string | null> }) {
  // Founder en tête, le reste dans l'ordre déclaré.
  const members = [...TEAM].sort((a, b) => (b.crown ? 1 : 0) - (a.crown ? 1 : 0));
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Les développeurs" sub="de l'idée au déploiement">
        <p className="text-sm text-muted leading-relaxed">
          42 League est un projet collectif. Chacun y a joué un rôle bien distinct — de la première
          idée jusqu'à la mise en production. <span className="text-muted-2">← glisse pour parcourir →</span>
        </p>
      </Panel>

      {/* Carrousel horizontal de cartes verticales (snap). */}
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
        {members.map((m) => (
          <MemberCard key={m.login} member={m} imageUrl={photos[m.login] ?? null} />
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, imageUrl }: { member: Member; imageUrl: string | null }) {
  const isRed = member.accent === 'red';
  return (
    <div
      className={`relative snap-start shrink-0 w-60 sm:w-64 rounded-2xl border bg-bg-2/50 p-5 flex flex-col items-center text-center overflow-hidden ${
        isRed ? 'border-red/25' : member.crown ? 'border-gold/50' : 'border-gold/25'
      }`}
    >
      {/* Halo doré derrière le founder */}
      {member.crown && (
        <div
          className="absolute inset-x-0 top-0 h-24 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 0%, rgba(255,201,74,0.18), transparent 70%)' }}
        />
      )}

      <div className="relative">
        {member.crown && (
          <Crown
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 text-gold drop-shadow-[0_2px_6px_rgba(255,201,74,0.6)] z-10"
            fill="currentColor"
            strokeWidth={2}
          />
        )}
        <Avatar
          login={member.login}
          imageUrl={imageUrl}
          size="xl"
          className={`ring-2 ring-offset-2 ring-offset-bg-2 ${
            isRed ? 'ring-red/50' : 'ring-gold/60'
          }`}
        />
      </div>

      <div className="mt-3 font-gaming text-base font-extrabold text-text-strong tracking-wide">
        {member.login}
      </div>
      <div
        className={`mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-0.5 rounded-md border ${
          isRed ? 'text-red border-red/30 bg-red/10' : 'text-gold border-gold/30 bg-gold/10'
        }`}
      >
        {member.role}
      </div>
      <p className="mt-3 text-sm text-muted leading-relaxed">{member.blurb}</p>
    </div>
  );
}
