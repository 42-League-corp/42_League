import { useT } from '../lib/i18n';

interface IntraStatusPillProps {
  /** Hôte 42 (ex. "c1r7s8") si le joueur est connecté sur un poste du cluster ;
   *  undefined = hors ligne / indisponible. */
  host?: string;
  className?: string;
}

/**
 * Encart « statut intra 42 » — indique si le joueur est actuellement connecté
 * sur un poste du cluster (disponible · vert) ou non (indisponible · rouge).
 * La présence provient de l'API 42 (endpoint /locations), rafraîchie toutes
 * les 5 min par useLeagueData. Réutilisé sur le profil mobile et desktop.
 */
export function IntraStatusPill({ host, className = '' }: IntraStatusPillProps) {
  const t = useT();
  const online = Boolean(host);
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border ${
        online ? 'bg-[#4ade80]/10 border-[#4ade80]/30' : 'bg-red/10 border-red/25'
      } ${className}`}
    >
      {/* Pastille : verte pulsante (en ligne) ou rouge fixe (hors ligne) */}
      <span className="relative flex h-3 w-3 shrink-0">
        {online && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-60 animate-ping" />
        )}
        <span
          className={`relative inline-flex h-3 w-3 rounded-full ${
            online
              ? 'bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.9)]'
              : 'bg-red shadow-[0_0_8px_rgba(255,83,102,0.6)]'
          }`}
        />
      </span>
      <span className="text-[11px] uppercase tracking-[0.16em] font-extrabold text-muted">
        {t('profil.intraStatus')}
      </span>
      <span
        className={`ml-auto inline-flex items-center gap-1.5 text-xs font-extrabold ${
          online ? 'text-[#4ade80]' : 'text-red'
        }`}
      >
        {online ? t('profil.available') : t('profil.unavailableStatus')}
        {host && <span className="font-mono text-[10px] font-bold text-muted-2">· {host}</span>}
      </span>
    </div>
  );
}
