import { motion } from 'framer-motion';
import { Clock, Swords } from 'lucide-react';
import { SwipeableCard } from '../../../mobile/primitives/SwipeableCard';
import { Avatar } from '../../../components/Avatar';
import { Button } from '../../../components/Button';
import { PlayerLink } from '../../../components/PlayerLink';
import type { Challenge } from '../../../lib/api';
import { fmtRelative } from '../../../lib/format';
import { useI18n } from '../../../lib/i18n';

type Kind = 'incoming' | 'outgoing' | 'accepted';

interface ChallengeMobileCardProps {
  challenge: Challenge;
  kind: Kind;
  myLogin: string | undefined;
  imageUrl?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

const KIND_LABEL: Record<Kind, string> = {
  incoming: 'Défi reçu',
  outgoing: 'Défi envoyé',
  accepted: 'Match prévu',
};

const KIND_TONE: Record<Kind, { border: string; badge: string; icon: string }> = {
  incoming: {
    border: 'border-teal/40',
    badge: 'bg-teal/15 text-teal',
    icon: 'text-teal',
  },
  outgoing: {
    border: 'border-border',
    badge: 'bg-bg-2 text-muted-2',
    icon: 'text-muted-2',
  },
  accepted: {
    border: 'border-gold/40',
    badge: 'bg-gold/15 text-gold',
    icon: 'text-gold',
  },
};

/**
 * Carte de défi mobile.
 * - Pour les "incoming" : swipe à gauche = refuser, swipe à droite = accepter
 * - Pour "outgoing" / "accepted" : pas de swipe, juste des boutons compacts
 */
export function ChallengeMobileCard({
  challenge,
  kind,
  myLogin,
  imageUrl,
  onAccept,
  onDecline,
}: ChallengeMobileCardProps) {
  const { lang } = useI18n();
  const opponent =
    challenge.challengerLogin === myLogin ? challenge.opponentLogin : challenge.challengerLogin;
  const when = fmtRelative(challenge.scheduledAt, lang);
  const tone = KIND_TONE[kind];

  const Inner = (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative bg-bg-1 border ${tone.border} rounded-2xl p-3.5 flex items-center gap-3`}
    >
      <Avatar login={opponent} imageUrl={imageUrl ?? null} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Swords className={`w-3 h-3 ${tone.icon}`} strokeWidth={2.5} />
          <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${tone.badge}`}>
            {KIND_LABEL[kind]}
          </span>
        </div>
        <PlayerLink login={opponent} className="font-bold text-text-strong text-sm">
          {opponent}
        </PlayerLink>
        <div className={`text-[11px] mt-0.5 flex items-center gap-1 ${when.late ? 'text-red' : 'text-muted-2'}`}>
          <Clock className="w-3 h-3" strokeWidth={2.5} />
          <span>{when.text}</span>
        </div>
      </div>

      {kind === 'outgoing' && (
        <Button size="sm" variant="ghost" onClick={onDecline} className="text-[10px]">
          Annuler
        </Button>
      )}
      {kind === 'accepted' && (
        <Button size="sm" onClick={onAccept} className="text-[10px]">
          Score
        </Button>
      )}
    </motion.div>
  );

  // Seulement les défis reçus sont swipeables (accepter/refuser).
  if (kind === 'incoming') {
    return (
      <SwipeableCard
        leftAction={{ label: 'Accepter', color: 'teal', onTrigger: onAccept }}
        rightAction={{ label: 'Refuser', color: 'red', onTrigger: onDecline }}
      >
        {Inner}
      </SwipeableCard>
    );
  }

  return Inner;
}
