import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Skull, Target } from 'lucide-react';
import { Avatar } from '../../../components/Avatar';
import { fmtCountdown } from '../../../lib/format';
import { useLeagueData } from '../../../hooks/useLeagueData';

/**
 * Card "Ops" mobile — ton ennemi juré + qui te traque.
 * Visuel rouge urgent.
 */
export function OpsCard() {
  const { opsMe } = useLeagueData();

  if (!opsMe) return null;

  const hasContent = !!opsMe.current || !!opsMe.targetedBy || !!opsMe.canDeclareAt;
  if (!hasContent) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-red/40 bg-gradient-to-br from-red/[0.08] to-bg-1/80 p-4"
    >
      {/* Scanline rouge top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red to-transparent animate-pulse" />

      <div className="flex items-center gap-2 mb-3 text-red font-extrabold text-xs uppercase tracking-[0.18em]">
        <Skull className="w-4 h-4" strokeWidth={2.5} fill="rgba(255,59,92,0.2)" />
        <span>Ops · Ennemi juré</span>
      </div>

      {opsMe.current && (
        <Link to={`/joueur/${opsMe.current.targetLogin}`} className="block tap-transparent">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              login={opsMe.current.target?.login ?? opsMe.current.targetLogin}
              imageUrl={opsMe.current.target?.imageUrl ?? null}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-text-strong truncate text-sm">
                {opsMe.current.targetLogin}
              </div>
              <div className="text-[11px] text-muted-2 font-mono">
                Traque · {fmtCountdown(opsMe.current.expiresAt)} restant
              </div>
            </div>
            <Target className="w-5 h-5 text-red flex-shrink-0" strokeWidth={2} />
          </div>
        </Link>
      )}

      {!opsMe.current && opsMe.canDeclareAt && (
        <div className="text-xs text-muted-2 leading-relaxed">
          ⏳ Cooldown actif · prochain ops dans{' '}
          <span className="font-mono text-muted">{fmtCountdown(opsMe.canDeclareAt)}</span>
        </div>
      )}

      {!opsMe.current && !opsMe.canDeclareAt && (
        <div className="text-xs text-muted-2 leading-relaxed">
          Va sur la fiche d'un joueur depuis le classement pour le déclarer comme ton ops.
        </div>
      )}

      {opsMe.targetedBy && (
        <>
          <div className="text-[10px] text-red uppercase tracking-wider mt-3 mb-2 font-extrabold">
            ⚠ Tu es la cible de :
          </div>
          <Link to={`/joueur/${opsMe.targetedBy.ownerLogin}`} className="block tap-transparent">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red/10 border border-red/20">
              <Avatar
                login={opsMe.targetedBy.owner?.login ?? opsMe.targetedBy.ownerLogin}
                imageUrl={opsMe.targetedBy.owner?.imageUrl ?? null}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-text-strong truncate text-sm">
                  {opsMe.targetedBy.ownerLogin}
                </div>
                <div className="text-[11px] text-red font-mono">
                  Te traque · libère dans {fmtCountdown(opsMe.targetedBy.expiresAt)}
                </div>
              </div>
            </div>
          </Link>
        </>
      )}
    </motion.section>
  );
}
