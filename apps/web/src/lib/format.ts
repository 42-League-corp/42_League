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
