import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Send, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useFlash } from '../hooks/useFlash';
import { useT } from '../lib/i18n';

const MIN = 10;
const MAX = 500;

/**
 * Boîte à idées — bloc invitant pour soumettre une feature.
 * Relié à POST /feature-requests (table FeatureRequest).
 * Affiché au-dessus des réglages.
 */
export function FeatureRequestBox() {
  const t = useT();
  const flash = useFlash();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN;
  const canSend = trimmed.length >= MIN && trimmed.length <= MAX && !busy;

  async function submit() {
    if (!canSend) return;
    setBusy(true);
    try {
      await api.createFeatureRequest(trimmed);
      setText('');
      setSent(true);
      flash.show(t('idea.sent'), 'info');
      setTimeout(() => setSent(false), 2600);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-2xl p-5 sm:p-6 card-hud">
      {/* Glow doré en fond */}
      <div
        className="absolute -top-16 -right-10 w-48 h-48 rounded-full pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(255,201,74,0.22), transparent 70%)',
          filter: 'blur(8px)',
        }}
      />

      <header className="relative flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 metal-plate-gold shadow-gold-glow">
          <Lightbulb className="w-5 h-5 text-[#1a1100]" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h2 className="font-gaming text-base font-extrabold uppercase tracking-[0.14em] text-text-strong leading-tight">
            {t('idea.title')}
          </h2>
          <p className="text-[11px] text-muted-2 leading-snug mt-0.5">
            {t('idea.subtitle')}
          </p>
        </div>
      </header>

      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          rows={3}
          placeholder={t('idea.placeholder')}
          className="w-full resize-none rounded-xl bg-bg-1 border border-border px-3.5 py-3 text-sm text-text-strong placeholder:text-muted outline-none transition-all allow-select focus:border-gold focus:shadow-[0_0_16px_rgba(255,201,74,0.18)]"
        />

        <div className="flex items-center justify-between gap-3 mt-2.5">
          <span
            className={`text-[10px] font-mono tabular-nums ${
              tooShort ? 'text-red' : 'text-muted'
            }`}
          >
            {tooShort
              ? t('idea.tooShort')
              : `${trimmed.length}/${MAX}`}
          </span>

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className={`relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] tap-transparent disabled:opacity-40 disabled:cursor-not-allowed shine metal-plate-gold text-[#1a1100] ${
              canSend ? 'hover:brightness-110 hover:shadow-gold-glow' : ''
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {sent ? (
                <motion.span
                  key="sent"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative z-10 inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" strokeWidth={3} />
                  {t('idea.thanks')}
                </motion.span>
              ) : (
                <motion.span
                  key="send"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative z-10 inline-flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {busy ? t('idea.sending') : t('idea.send')}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    </section>
  );
}
