import { useState, useEffect } from 'react';
import { Button } from './Button';

interface ContestModalProps {
  declarerLogin: string;
  score: string;
  busy: boolean;
  onSubmit: (reason: 'never_played' | 'wrong_score', message: string) => void;
  onClose: () => void;
}

export function ContestModal({
  declarerLogin,
  score,
  busy,
  onSubmit,
  onClose,
}: ContestModalProps) {
  const [reason, setReason] = useState<'never_played' | 'wrong_score' | null>(null);
  const [message, setMessage] = useState('');
  const canSubmit = reason !== null && message.trim().length >= 10 && !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-0 border border-red/30 rounded-xl p-5 sm:p-6 w-full max-w-md shadow-[0_18px_48px_rgba(0,0,0,0.6),0_0_40px_rgba(255,59,92,0.12)] animate-pop">

        {/* Title */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-red mb-1">
              Contester ce score
            </div>
            <div className="text-[11px] text-muted-2">
              <span className="font-semibold text-text-strong">{declarerLogin}</span>
              {' '}a déclaré{' '}
              <span className="font-bold tabular-nums text-text-strong">{score}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text-strong transition-colors text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/10"
          >
            ×
          </button>
        </div>

        {/* Trust warning */}
        <div className="mb-4 bg-red/[0.07] border border-red/25 rounded-lg px-3 py-2.5 text-[11px] text-[#ff8095] leading-relaxed">
          ⚠ Ce système est basé sur la <strong>confiance</strong>. Une contestation injustifiée nuit à la communauté.
        </div>

        {/* Reason selector */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
            Motif
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'never_played', label: "La game n'a jamais eu lieu", icon: '🚫' },
              { value: 'wrong_score', label: 'Le score est incorrect', icon: '❌' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setReason(opt.value)}
                className={`p-3 rounded-lg border text-left transition-all duration-150 ${
                  reason === opt.value
                    ? 'border-red/60 bg-red/10 text-text-strong'
                    : 'border-border bg-bg-2/40 text-muted-2 hover:border-border-hover hover:bg-bg-2'
                }`}
              >
                <div className="text-lg mb-1">{opt.icon}</div>
                <div className="text-[11px] font-semibold leading-tight">{opt.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">
              Explique-toi <span className="text-red">*</span>
            </div>
            <div className={`text-[10px] tabular-nums ${message.length < 10 ? 'text-red/70' : 'text-muted'}`}>
              {message.length} / 500
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            placeholder="Décris ce qui s'est réellement passé (min. 10 caractères)…"
            rows={3}
            className="w-full px-3 py-2.5 bg-bg-0 border border-border rounded-lg text-sm focus:border-red/60 outline-none resize-none text-text-strong placeholder:text-muted transition-colors leading-relaxed"
          />
          {message.length > 0 && message.trim().length < 10 && (
            <p className="mt-1 text-[10px] text-red/70">Au moins 10 caractères requis.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            loading={busy}
            disabled={!canSubmit}
            onClick={() => reason && onSubmit(reason, message.trim())}
            className="flex-1"
          >
            Envoyer la contestation
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
