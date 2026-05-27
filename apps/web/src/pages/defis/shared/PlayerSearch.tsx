import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { LeaderboardEntry } from '../../../lib/api';

interface PlayerSearchProps {
  players: LeaderboardEntry[];
  recentPlayers: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  selected: LeaderboardEntry | null;
  onSelect: (p: LeaderboardEntry) => void;
  onClear: () => void;
  /** En mode mobile, on autofocus et on remonte les résultats au-dessus du clavier. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Combobox de recherche d'adversaire, partagé Desktop/Mobile.
 * - Tri par récents (fréquence) en tête, puis le reste
 * - Filtre par préfixe sur le login
 * - Navigation clavier (↑ ↓ Enter Esc)
 * - Highlight des matches dans le nom
 */
export function PlayerSearch({
  players,
  recentPlayers,
  opponentCounts,
  selected,
  onSelect,
  onClear,
  variant = 'desktop',
}: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleList = useMemo(() => {
    if (normalizedQuery) {
      return players.filter((p) => p.login.toLowerCase().includes(normalizedQuery));
    }
    const recentLogins = new Set(recentPlayers.map((p) => p.login));
    const rest = players.filter((p) => !recentLogins.has(p.login));
    return [...recentPlayers, ...rest];
  }, [normalizedQuery, players, recentPlayers]);

  const commit = useCallback(
    (p: LeaderboardEntry) => {
      onSelect(p);
      setQuery('');
      setOpen(false);
      setActiveIdx(0);
    },
    [onSelect],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key !== 'Escape') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, visibleList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = visibleList[activeIdx];
      if (pick) commit(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-1 border-2 border-teal/40 rounded-xl animate-pop shadow-sm">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-teal/50 shadow-sm">
          {selected.imageUrl ? (
            <img src={selected.imageUrl} alt={selected.login} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-teal-deep flex items-center justify-center text-sm font-bold text-[#001416]">
              {selected.login[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <span className="font-extrabold text-base text-text-strong flex-1 truncate">{selected.login}</span>
        <span className="text-teal text-sm font-bold bg-teal/10 px-2 py-1 rounded-md font-mono tabular-nums">{selected.elo}</span>
        <button
          type="button"
          aria-label="Changer d'adversaire"
          onClick={() => {
            onClear();
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="ml-1 text-muted hover:text-red transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-red/10 tap-transparent"
        >
          <X className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  const showingRecents = !normalizedQuery && recentPlayers.length > 0;
  const isMobile = variant === 'mobile';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" strokeWidth={2.5} />
        <input
          ref={inputRef}
          autoFocus={isMobile}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tape un pseudo…"
          aria-label="Rechercher un adversaire"
          className="w-full pl-11 pr-4 py-3.5 bg-bg-1 border-2 border-border rounded-xl text-base font-medium focus:border-teal outline-none text-text-strong placeholder:text-muted transition-all shadow-sm focus:shadow-md tap-transparent allow-select"
        />
      </div>

      {open && visibleList.length > 0 && (
        <div
          className={`${isMobile ? 'relative w-full mt-3' : 'absolute z-50 w-full mt-2'} bg-bg-1 border border-border rounded-xl shadow-2xl overflow-hidden animate-pop`}
        >
          {showingRecents && (
            <div className="flex items-center justify-between px-4 py-2 bg-bg-2/50 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                Tes adversaires
              </span>
              <span className="text-[10px] text-muted-2 font-mono">
                {recentPlayers.length} joué·s
              </span>
            </div>
          )}
          <div className={`${isMobile ? 'max-h-[40vh]' : 'max-h-72'} overflow-y-auto custom-scrollbar`}>
            {visibleList.map((p, i) => {
              const count = opponentCounts[p.login] ?? 0;
              const played = count > 0;
              return (
                <button
                  key={p.login}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); commit(p); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors tap-transparent ${
                    i === activeIdx
                      ? 'bg-teal/10 text-text-strong border-l-2 border-teal'
                      : 'hover:bg-bg-2 text-muted-2 border-l-2 border-transparent'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border shadow-sm">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.login} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-teal-deep flex items-center justify-center text-sm font-bold text-[#001416]">
                        {p.login[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      <HighlightMatch text={p.login} query={query} />
                    </div>
                    <div className="text-[11px] text-muted font-medium">
                      {played ? (
                        <span className="text-teal/80">
                          {count} game{count > 1 ? 's' : ''} jouée{count > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span>Jamais joué</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0 font-mono">
                    <span className="text-sm text-teal font-extrabold leading-none tabular-nums">{p.elo}</span>
                    <span className="text-[10px] text-muted font-medium leading-none tabular-nums">#{p.rank}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && normalizedQuery.length > 0 && visibleList.length === 0 && (
        <div className="absolute z-50 w-full mt-2 bg-bg-1 border border-border rounded-xl shadow-2xl px-4 py-4 text-sm text-muted font-medium text-center animate-pop">
          Aucun joueur trouvé
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-teal">{text.slice(idx, idx + trimmed.length)}</span>
      {text.slice(idx + trimmed.length)}
    </>
  );
}
