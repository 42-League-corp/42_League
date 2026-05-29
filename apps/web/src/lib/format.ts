export function fmtRelative(iso: string, lang: 'fr' | 'en'): { text: string; late: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const absMin = Math.round(Math.abs(diff) / 60_000);
  const fr = lang === 'fr';
  if (diff >= 0) {
    if (absMin < 1) return { text: fr ? 'maintenant' : 'now', late: false };
    if (absMin === 1) return { text: fr ? 'dans 1 minute' : 'in 1 minute', late: false };
    if (absMin < 60) return { text: fr ? `dans ${absMin} min` : `in ${absMin} min`, late: false };
    const h = Math.floor(absMin / 60);
    return {
      text: fr ? (h === 1 ? 'dans 1 heure' : `dans ${h} h`) : `in ${h}h`,
      late: false,
    };
  }
  if (absMin < 1) return { text: fr ? "à l'instant" : 'just now', late: false };
  if (absMin === 1) return { text: fr ? 'il y a 1 minute' : '1 minute ago', late: true };
  if (absMin < 60) {
    return { text: fr ? `il y a ${absMin} min` : `${absMin} min ago`, late: true };
  }
  const h = Math.floor(absMin / 60);
  return {
    text: fr ? (h === 1 ? 'il y a 1 heure' : `il y a ${h} h`) : `${h}h ago`,
    late: true,
  };
}

export function fmtCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'terminé';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}j ${hours}h`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

export function isoLocalNowPlusMinutes(mins: number): string {
  const d = new Date(Date.now() + mins * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/**
 * Date « en lettres » élégante : « 12 janvier », « 4 février ».
 * L'année n'est ajoutée que si la date n'est pas dans l'année courante.
 */
export function fmtDateLong(iso: string, locale: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(
    locale,
    sameYear
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  );
}

/** Début de journée locale (00:00) en ms — utilitaire pour comparer des jours. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Libellé de jour humain : « Aujourd'hui », « Hier », sinon date en lettres.
 * Idéal pour grouper / dater des cartes d'historique sans bruit numérique.
 */
export function fmtDayLabel(iso: string, lang: 'fr' | 'en'): string {
  const d = new Date(iso);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (dayDiff === 0) return lang === 'fr' ? "Aujourd'hui" : 'Today';
  if (dayDiff === 1) return lang === 'fr' ? 'Hier' : 'Yesterday';
  if (dayDiff === -1) return lang === 'fr' ? 'Demain' : 'Tomorrow';
  return fmtDateLong(iso, locale);
}

/** Heure locale « HH:MM » (zéro-paddé). */
export function fmtTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
