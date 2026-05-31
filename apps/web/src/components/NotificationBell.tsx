import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Swords, Trophy, Skull, UserPlus, CheckCheck, type LucideIcon } from 'lucide-react';
import { api, type AppNotification } from '../lib/api';
import { useServerEvents } from '../hooks/useServerEvents';

const POLL_MS = 30_000;

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  challenge_received: Swords,
  match_pending: Swords,
  match_result: Trophy,
  tournament: Trophy,
  ops_targeted: Skull,
  new_player: UserPlus,
};

const COLOR_BY_TYPE: Record<string, string> = {
  challenge_received: 'text-teal',
  match_pending: 'text-gold',
  match_result: 'text-gold',
  tournament: 'text-gold',
  ops_targeted: 'text-red',
  new_player: 'text-[#7fd66e]',
};

/** Temps relatif court en français. */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

/**
 * Cloche de notifications : pastille rouge avec le compte non-lu, dropdown au
 * clic. Polling toutes les 30s + rafraîchissement instantané via SSE.
 */
export function NotificationBell({ placement = 'down' }: { placement?: 'up' | 'down' }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.notifications);
      setUnread(res.unread);
    } catch {
      /* silencieux : la cloche ne doit pas casser l'app */
    }
  }, []);

  // Chargement initial + polling 30s.
  useEffect(() => {
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Rafraîchissement instantané sur signal SSE.
  useServerEvents(load, ['notification']);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const markAll = async () => {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await api.markNotificationsRead().catch(() => {});
  };

  const onClickItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      await api.markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-2 hover:text-gold hover:bg-bg-2/60 transition-colors"
      >
        <Bell className="w-5 h-5" strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red text-white text-[9px] font-black tabular-nums ring-2 ring-bg-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 w-80 max-w-[90vw] z-[100] card-hud rounded-xl shadow-2xl overflow-hidden animate-pop ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gold/15 bg-bg-2/50">
            <span className="text-[11px] uppercase tracking-wider text-gold font-extrabold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="inline-flex items-center gap-1 text-[10px] text-muted-2 hover:text-gold transition-colors font-bold"
              >
                <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                Tout lire
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-2">Aucune notification</div>
            ) : (
              items.map((n) => {
                const Icon = ICON_BY_TYPE[n.type] ?? Bell;
                const color = COLOR_BY_TYPE[n.type] ?? 'text-muted-2';
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onClickItem(n)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left border-b border-border/30 last:border-0 transition-colors hover:bg-bg-2/60 ${
                      n.read ? 'opacity-60' : 'bg-gold/[0.04]'
                    }`}
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-text-strong truncate">{n.title}</span>
                      {n.body && <span className="block text-[11px] text-muted-2 leading-snug">{n.body}</span>}
                      <span className="block text-[10px] text-muted mt-0.5 font-mono">{ago(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-gold flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
