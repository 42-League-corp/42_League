import { titleMeta } from '../lib/titleMeta';

/** Contenu de l'infobulle d'un titre (libellé + statut unique/obtenable + moyen).
 *  `null` si pas de titre → l'infobulle ne s'affiche pas. */
export function titleTooltipContent(label: string | null | undefined) {
  const m = titleMeta(label);
  if (!m || !label) return null;
  return (
    <>
      <div className="text-xs font-extrabold text-gold">“{label}”</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gold/80">{m.heading}</div>
      <div className="mt-1 text-[11px] leading-snug text-muted-2">{m.body}</div>
    </>
  );
}
