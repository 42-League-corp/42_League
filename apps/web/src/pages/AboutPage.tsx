import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Shield, Terminal, Users, Crown } from 'lucide-react';
import { Panel } from '../components/Panel';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { useAuth } from '../hooks/useAuth';
import { useLeagueData } from '../hooks/useLeagueData';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

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

// ─── Règles du jeu (adaptées à la discipline courante) ───────────────────────

/**
 * Contenu des règles propre à chaque discipline. Pour ajouter un jeu, il suffit
 * d'ajouter une entrée à ce `Record<Game, GameRules>` — la `RulesSection` lit
 * automatiquement la discipline active via `useGameMode()`.
 */
type GameRules = {
  /** Nom de la discipline, employé dans les phrases (ex. « babyfoot 1 contre 1 »). */
  label: string;
  /** Panneau « règles sur le terrain » : intro + puces. */
  terrain: { intro: React.ReactNode; bullets: React.ReactNode[] };
  /** Panneau « format du match » : intro + puces. */
  format: { intro: React.ReactNode; bullets: React.ReactNode[] };
};

const RULES: Record<Game, GameRules> = {
  babyfoot: {
    label: 'babyfoot 1 contre 1',
    terrain: {
      intro: (
        <>
          Conventions de jeu pour qu'un but soit valable et que les matchs restent disputés
          proprement :
        </>
      ),
      bullets: [
        <>
          Après l'engagement (<span className="text-text font-semibold">kick-off</span>), la balle doit
          être <span className="text-gold font-semibold">touchée au moins deux fois</span> avant qu'un but
          ne compte.
        </>,
        <>
          Le joueur qui <span className="text-text font-semibold">vient d'encaisser un but</span> a le droit
          de remettre la balle <span className="text-gold font-semibold">au pied de sa barre du milieu</span> (demis)
          pour relancer.
        </>,
        <>
          Les <span className="text-gold font-semibold">buts marqués depuis la barre du milieu</span> (demis)
          sont valables.
        </>,
        <>
          La <span className="text-gold font-semibold">gamelle</span> (balle qui ressort du but) : tu peux
          soit <span className="text-text font-semibold">prendre le point</span>, soit
          <span className="text-text font-semibold"> retirer un point à l'adversaire</span> — mais on ne peut
          <span className="text-text font-semibold"> pas conclure le match sur une gamelle</span>.
        </>,
        <>
          Les <span className="text-gold font-semibold">roulettes</span> doivent être
          <span className="text-text font-semibold"> contrôlées</span> (pas de moulinets incontrôlés).
        </>,
      ],
    },
    format: {
      intro: (
        <>
          42 League est un classement ELO de <span className="text-text font-semibold">babyfoot 1 contre 1</span>.
          Chaque joueur inscrit peut défier n'importe quel autre membre de sa league.
        </>
      ),
      bullets: [
        <>Match en <span className="text-gold font-semibold">10 buts</span> — premier arrivé à 10 gagne.</>,
        <>Un match ne peut être déclaré qu'<span className="text-text font-semibold">après avoir été joué</span>.</>,
        <>Les deux joueurs déclarent leur score indépendamment. En cas de désaccord, le match est annulé.</>,
      ],
    },
  },
  smash: {
    label: 'Super Smash Bros. 1 contre 1',
    terrain: {
      intro: (
        <>
          Conventions de set pour que la victoire soit nette et les matchs équitables :
        </>
      ),
      bullets: [
        <>
          Chaque match se joue en <span className="text-gold font-semibold">stocks (vies)</span> — le joueur
          qui épuise tous ses stocks adverses remporte la manche.
        </>,
        <>
          Sélection de <span className="text-gold font-semibold">personnage</span> avant chaque manche ; après
          une manche perdue, le perdant peut <span className="text-text font-semibold">changer de personnage</span>.
        </>,
        <>
          Les sets se disputent au <span className="text-gold font-semibold">meilleur des 3 (Bo3)</span> ou{' '}
          <span className="text-gold font-semibold">des 5 (Bo5)</span> selon le contexte (officiel, tournoi).
        </>,
        <>
          Les <span className="text-text font-semibold">items</span> et stages contestés sont désactivés par
          défaut, sauf accord explicite des deux joueurs.
        </>,
      ],
    },
    format: {
      intro: (
        <>
          42 League classe ici le <span className="text-text font-semibold">Super Smash Bros. 1 contre 1</span> en
          stocks. Chaque joueur inscrit peut défier n'importe quel autre membre de sa league.
        </>
      ),
      bullets: [
        <>Set au <span className="text-gold font-semibold">meilleur des 3 ou des 5</span> manches (Bo3 / Bo5).</>,
        <>Le vainqueur est celui qui remporte la <span className="text-text font-semibold">majorité des manches</span>.</>,
        <>L'<span className="text-text font-semibold">ELO est propre à la discipline</span> : ton rating Smash est distinct du babyfoot.</>,
        <>Les deux joueurs déclarent leur résultat indépendamment. En cas de désaccord, le match est annulé.</>,
      ],
    },
  },
  chess: {
    label: 'échecs 1 contre 1',
    terrain: {
      intro: (
        <>
          Conventions de partie pour que le résultat soit incontestable :
        </>
      ),
      bullets: [
        <>
          Partie en <span className="text-gold font-semibold">1 contre 1</span> aux règles classiques des échecs
          (pièce touchée, pièce jouée).
        </>,
        <>
          Le résultat est <span className="text-gold font-semibold">binaire</span> : victoire ou défaite. Une
          nulle se rejoue ou se tranche selon l'accord des joueurs.
        </>,
        <>
          La victoire est acquise par <span className="text-text font-semibold">échec et mat</span> ou par
          <span className="text-text font-semibold"> abandon</span> de l'adversaire.
        </>,
        <>
          Si une <span className="text-text font-semibold">cadence</span> (pendule) est utilisée, la chute du
          drapeau vaut défaite.
        </>,
      ],
    },
    format: {
      intro: (
        <>
          42 League classe ici les <span className="text-text font-semibold">échecs 1 contre 1</span>. Chaque
          joueur inscrit peut défier n'importe quel autre membre de sa league.
        </>
      ),
      bullets: [
        <>Résultat <span className="text-gold font-semibold">binaire</span> — victoire ou défaite, pas de score chiffré.</>,
        <>Un match ne peut être déclaré qu'<span className="text-text font-semibold">après avoir été joué</span>.</>,
        <>L'<span className="text-text font-semibold">ELO est dédié aux échecs</span>, distinct des autres disciplines.</>,
        <>Les deux joueurs déclarent leur résultat indépendamment. En cas de désaccord, le match est annulé.</>,
      ],
    },
  },
  streetfighter: {
    label: 'Street Fighter 1 contre 1',
    terrain: {
      intro: (
        <>
          Conventions de set pour que la victoire soit nette et les matchs équitables :
        </>
      ),
      bullets: [
        <>
          Chaque match se joue en <span className="text-gold font-semibold">rounds</span> — le joueur qui
          remporte la majorité des rounds gagne la manche.
        </>,
        <>
          Sélection de <span className="text-gold font-semibold">personnage</span> avant chaque manche ; après
          une manche perdue, le perdant peut <span className="text-text font-semibold">changer de personnage</span>.
        </>,
        <>
          Les sets se disputent au <span className="text-gold font-semibold">meilleur des 3 (Bo3)</span> ou{' '}
          <span className="text-gold font-semibold">des 5 (Bo5)</span> selon le contexte (officiel, tournoi).
        </>,
      ],
    },
    format: {
      intro: (
        <>
          42 League classe ici le <span className="text-text font-semibold">Street Fighter 1 contre 1</span>.
          Chaque joueur inscrit peut défier n'importe quel autre membre de sa league.
        </>
      ),
      bullets: [
        <>Set au <span className="text-gold font-semibold">meilleur des 3 ou des 5</span> manches (Bo3 / Bo5).</>,
        <>Le vainqueur est celui qui remporte la <span className="text-text font-semibold">majorité des manches</span>.</>,
        <>L'<span className="text-text font-semibold">ELO est propre à la discipline</span> : ton rating Street Fighter est distinct des autres jeux.</>,
        <>Les deux joueurs déclarent leur résultat indépendamment. En cas de désaccord, le match est annulé.</>,
      ],
    },
  },
};

function RulesSection() {
  const { game } = useGameMode();
  const rules = RULES[game];
  return (
    <div className="flex flex-col gap-4">
      {/* En tête, pleine largeur : les règles propres à la discipline active. */}
      <Panel title="Règles sur le terrain" accent="book">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>{rules.terrain.intro}</p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            {rules.terrain.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </Panel>

      {/* Le système ELO en pleine largeur : la formule détaillée mérite l'espace. */}
      <EloSection game={game} />

      {/* Rangée régulière de 3 panneaux « méta », hauteurs égales. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      <Panel title="Format du match">
        <div className="space-y-3 text-sm text-muted leading-relaxed">
          <p>{rules.format.intro}</p>
          <ul className="space-y-1.5 pl-3 border-l border-gold/25">
            {rules.format.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
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
            Deux formats : <span className="text-text font-semibold">élimination directe</span> (bracket,
            byes auto si besoin) ou <span className="text-text font-semibold">phase de poules</span> (dès 12
            joueurs — poules de 4, 2 qualifiés par poule, puis bracket des qualifiés). Les tournois{' '}
            <span className="text-gold font-semibold">officiels</span> sont créés par les admins et donnent des
            récompenses spéciales ; les <span className="text-text font-semibold">amicaux</span> sont ouverts à
            tous, sans impact ELO, et ne figurent dans l'historique que pour leurs participants.
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
 * L'ELO est calculé indépendamment par discipline : ne change que la phrase
 * d'introduction (et la mention de l'écart de buts, propre aux jeux scorés).
 */
function EloSection({ game }: { game: Game }) {
  // L'écart de buts (multiplicateur M) n'a de sens que pour le babyfoot, qui se
  // joue en score chiffré. Smash et échecs ont un résultat sans écart de buts.
  const scored = game === 'babyfoot';
  return (
    <Panel title="Système ELO" sub="comment les points sont calculés">
      <div className="space-y-5 text-sm text-muted leading-relaxed">
        <p>
          Le classement repose sur un système <span className="text-gold font-semibold">ELO dérivé des échecs</span>,
          appliqué <span className="text-text font-semibold">par discipline</span> ({RULES[game].label}).
          Chaque joueur démarre à{' '}
          <span className="text-text font-semibold">1000 points</span>. À chaque match, des points sont
          transférés du perdant vers le gagnant — d'autant plus que le résultat était{' '}
          <span className="text-text font-semibold">inattendu</span>
          {scored ? (
            <> et la victoire <span className="text-text font-semibold">large</span></>
          ) : null}
          .
        </p>

        {/* La formule mise en avant */}
        <div className="rounded-xl border border-gold/25 bg-bg-2/50 p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-2 mb-3">
            Points transférés
          </div>
          <div className="font-gaming text-center text-base sm:text-lg text-text-strong tracking-wide">
            <span className="text-gold">K</span> ×{' '}
            {scored ? (
              <>
                <span className="text-gold">M</span> ×{' '}
              </>
            ) : null}
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
          {scored ? (
            <EloTerm symbol="M" label="Multiplicateur d'écart de buts">
              <code className="bg-bg-2 px-1 py-0.5 rounded text-xs text-text">1 + (10 − score_perdant) × 0,1</code> :
              gagner <span className="text-text font-semibold">10–0</span> pèse davantage qu'un{' '}
              <span className="text-text font-semibold">10–9</span> serré. L'ampleur de la victoire compte.
            </EloTerm>
          ) : null}
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
            {scored ? 'Exemple — tu es à 1000 ELO et tu gagnes 10–5' : 'Exemple — tu es à 1000 ELO et tu gagnes'}
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
            {scored ? 'Même score, même victoire' : 'Même victoire'} : l'exploit face au joueur à +400 d'écart
            rapporte <span className="text-text font-semibold">deux fois plus de points</span>.
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
            <span className="text-text font-semibold">Ranked illimité</span> —{' '}
            <span className="text-text font-semibold">chaque match compte pour l'ELO</span>, sans
            limite par jour ni par adversaire.
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
  accent: 'gold' | 'red' | 'violet';
  crown?: boolean;
  blurb: React.ReactNode;
};

// Ordre d'affichage du carrousel (gauche → droite). nithomas est centré au
// démarrage, avec throbert à sa gauche et abidaux à sa droite.
const TEAM: Member[] = [
  {
    login: 'throbert',
    role: 'Founder',
    accent: 'gold',
    blurb: (
      <>
        Celui qui a transformé l'idée en vrai projet. La{' '}
        <span className="text-text font-semibold">vision d'origine</span> : un{' '}
        <span className="text-text font-semibold">classement ELO 1v1</span> du campus, juste et
        vivant. Aujourd'hui il pousse les{' '}
        <span className="text-gold font-semibold">features principales</span> — étendre les jeux
        (babyfoot, Smash, échecs…), les <span className="text-text font-semibold">tournois</span>,
        défis programmés, OPS et trophées.
      </>
    ),
  },
  {
    login: 'nithomas',
    role: 'Parrain',
    accent: 'gold',
    blurb: (
      <>
        Tout est parti d'une <span className="text-text font-semibold">idée qu'il a lâchée</span> un
        jour, comme ça. Sans cette première étincelle, 42 League serait jamais sorti de terre.
      </>
    ),
  },
  {
    login: 'abidaux',
    role: 'Cofondateur',
    accent: 'gold',
    blurb: (
      <>
        Il a transformé l'<span className="text-text font-semibold">extension de campus</span> en
        vrai site web, puis l'a <span className="text-gold font-semibold">hébergé et déployé en ligne</span>.
        C'est lui notamment derrière les <span className="text-text font-semibold">designs et les animations</span>.
      </>
    ),
  },
  {
    login: 'jagharra',
    role: 'Sécurité · Pentester',
    accent: 'violet',
    blurb: (
      <>
        Son expertise en <span className="text-text font-semibold">cybersécurité</span> a blindé le
        projet : il audite les routes, traque les failles et{' '}
        <span className="text-[#c97bff] font-semibold">patch avant que ça devienne un problème</span>.
        Pas de vulnérabilité qui passe entre ses doigts.
      </>
    ),
  },
  {
    login: 'rbardet-',
    role: 'Conseiller UX/UI',
    accent: 'red',
    blurb: (
      <>
        Son <span className="text-text font-semibold">expertise e-sport</span> et sa connaissance
        des sites de ranked ont beaucoup pesé : c'est lui qui a apporté l'
        <span className="text-text font-semibold">analyse UX/UI</span> pour rendre l'app nette et
        lisible.
      </>
    ),
  },
  {
    login: 'sbonneau',
    role: 'Pen tester · Abuser',
    accent: 'red',
    blurb: (
      <>
        Le <span className="text-text font-semibold">pen tester</span> de service : il cherche la
        faille, <span className="text-text font-semibold">abuse</span> de chaque fonctionnalité pour
        la pousser dans ses retranchements — et{' '}
        <span className="text-[#ff5366] font-semibold">casse ce qui doit l'être</span> avant les
        autres.
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

// La photo intra d'un membre est la même quel que soit le jeu, mais le
// `leaderboard` du contexte est *par mode* : un membre absent du classement du
// mode courant (ex. il n'a pas joué aux échecs) n'y figure pas, et sa photo
// disparaîtrait en changeant de mode. On récupère donc les photos directement
// par login (indépendant du mode), avec le leaderboard courant comme amorce.
function TeamSectionAuthed() {
  const { leaderboard } = useLeagueData();
  const [fetched, setFetched] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      TEAM.map(async (m) => {
        try {
          const { user } = await api.userProfile(m.login);
          return [m.login, user.imageUrl] as const;
        } catch {
          return [m.login, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setFetched(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Amorce immédiate depuis le leaderboard courant (évite un flash), puis
  // complétée/écrasée par les photos récupérées par login.
  const photos: Record<string, string | null> = {};
  for (const u of leaderboard) photos[u.login] = u.imageUrl;
  for (const [login, url] of Object.entries(fetched)) {
    if (url) photos[login] = url;
  }
  return <TeamCarousel photos={photos} />;
}

function TeamCarousel({ photos }: { photos: Record<string, string | null> }) {
  // Ordre déclaré tel quel : nithomas centré au démarrage (throbert à gauche,
  // abidaux à droite).
  const members = TEAM;
  const startIndex = Math.max(0, members.findIndex((m) => m.login === 'nithomas'));
  const [active, setActive] = useState(startIndex);
  const touchX = useRef<number | null>(null);
  const wheelLock = useRef(false);

  const n = members.length;
  // Carrousel infini : on boucle modulo n (pas de butée aux extrémités).
  const go = (dir: number) => setActive((i) => (i + dir + n) % n);

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };
  // Molette / trackpad : un cran = une carte, avec un petit verrou anti-rafale.
  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(d) < 8 || wheelLock.current) return;
    wheelLock.current = true;
    go(d > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLock.current = false;
    }, 350);
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Les développeurs" sub="de l'idée au déploiement">
        <p className="text-sm text-muted leading-relaxed">
          42 League est un projet collectif. Chacun y a joué un rôle bien distinct — de la première
          idée jusqu'à la mise en production.{' '}
          <span className="text-muted-2">← glisse, scrolle ou clique pour parcourir →</span>
        </p>
      </Panel>

      {/* Carrousel « coverflow » : carte centrale nette, voisines en retrait et floutées. */}
      <div
        className="relative h-[480px] sm:h-[560px] select-none touch-pan-y overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {members.map((m, i) => {
          // Décalage circulaire : une carte « au bout » réapparaît de l'autre
          // côté (effet coverflow infini).
          let offset = i - active;
          if (offset > n / 2) offset -= n;
          else if (offset < -n / 2) offset += n;
          const abs = Math.abs(offset);
          const hidden = abs > 2;
          return (
            <div
              key={m.login}
              className="absolute top-1/2 left-1/2 transition-all duration-300 ease-out will-change-transform"
              style={{
                transform: `translate(-50%, -50%) translateX(${offset * 58}%) scale(${
                  offset === 0 ? 1 : 0.82
                })`,
                filter: offset === 0 ? 'none' : 'blur(2px)',
                opacity: hidden ? 0 : offset === 0 ? 1 : abs === 1 ? 0.55 : 0.25,
                zIndex: 10 - abs,
                pointerEvents: hidden ? 'none' : 'auto',
              }}
              onClick={() => offset !== 0 && setActive(i)}
              aria-hidden={offset !== 0}
            >
              <MemberCard member={m} imageUrl={photos[m.login] ?? null} active={offset === 0} />
            </div>
          );
        })}

        {/* Flèches de navigation */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Précédent"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 rounded-full bg-bg-2/80 border border-border/60 text-text hover:text-gold hover:border-gold/40 transition-all"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Suivant"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 rounded-full bg-bg-2/80 border border-border/60 text-text hover:text-gold hover:border-gold/40 transition-all"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Pagination par points */}
      <div className="flex justify-center gap-2">
        {members.map((m, i) => (
          <button
            key={m.login}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Aller à ${m.login}`}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? 'w-6 bg-gold' : 'w-1.5 bg-border hover:bg-muted-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Styles d'accent par membre (bordure de carte + pastille de rôle).
const ACCENT: Record<Member['accent'], { border: string; badge: string }> = {
  gold: { border: 'border-gold/50', badge: 'text-gold border-gold/40 bg-gold/15' },
  red: { border: 'border-red/40', badge: 'text-red border-red/40 bg-red/15' },
  violet: {
    border: 'border-[#c97bff]/55',
    badge: 'text-[#c97bff] border-[#c97bff]/40 bg-[#c97bff]/15',
  },
};

function MemberCard({
  member,
  imageUrl,
  active,
}: {
  member: Member;
  imageUrl: string | null;
  active: boolean;
}) {
  const accent = ACCENT[member.accent];
  const [broken, setBroken] = useState(false);
  const showImg = imageUrl && !broken;
  return (
    <div
      className={`relative w-[280px] sm:w-[330px] h-[440px] sm:h-[520px] rounded-2xl overflow-hidden border-2 bg-bg-2 transition-shadow duration-300 ${
        accent.border
      } ${active ? 'shadow-[0_24px_60px_-18px_rgba(0,0,0,0.75)]' : 'shadow-lg'}`}
    >
      {/* Image intra plein cadre (ou initiale en repli) */}
      {showImg ? (
        <img
          src={imageUrl}
          alt={member.login}
          draggable={false}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center font-display text-7xl font-bold text-white/90"
          style={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' }}
        >
          {(member.login[0] ?? '?').toUpperCase()}
        </div>
      )}

      {/* Dégradé bas pour lisibilité du texte */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(8,11,18,0.97) 0%, rgba(8,11,18,0.82) 30%, rgba(8,11,18,0.25) 52%, transparent 68%)',
        }}
      />

      {/* Couronne du founder */}
      {member.crown && (
        <Crown
          className="absolute top-3 right-3 w-6 h-6 text-gold drop-shadow-[0_2px_6px_rgba(255,201,74,0.7)] z-10"
          fill="currentColor"
          strokeWidth={2}
        />
      )}

      {/* Contenu texte en bas */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="font-gaming text-xl sm:text-2xl font-extrabold text-white tracking-wide">
          {member.login}
        </div>
        <div
          className={`inline-block mt-2 text-[11px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-md border ${accent.badge}`}
        >
          {member.role}
        </div>
        <p className="mt-3 text-sm text-white/85 leading-relaxed">{member.blurb}</p>
      </div>
    </div>
  );
}
