import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';
import { useFlash } from '../../hooks/useFlash';
import { useLeagueData } from '../../hooks/useLeagueData';
import { haptic } from '../../mobile/feedback/useHaptic';
import { useT } from '../../lib/i18n';

type Capacity = 8 | 16;

export function CreateTournamentPage() {
  const navigate = useNavigate();
  const flash = useFlash();
  const { refresh } = useLeagueData();
  const t = useT();

  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<Capacity>(8);
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0;

  const submit = async () => {
    const n = name.trim();
    if (!n) { haptic('error'); return; }
    setBusy(true);
    try {
      const tNew = await api.createTournament({ name: n, capacity, kind: 'friendly' });
      haptic('success');
      await refresh();
      navigate(`/tournaments/${encodeURIComponent(tNew.id)}`, { replace: true });
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-8 pb-8">

      {/* ── Back ── */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="self-start flex items-center gap-1.5 text-muted text-sm font-semibold active:opacity-60 transition-opacity tap-transparent -ml-0.5"
        aria-label={t('tournois.createPage.back')}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
        {t('tournois.createPage.back')}
      </button>

      {/* ── Hero visuel ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-center py-10 gap-3"
        style={{
          background: 'linear-gradient(160deg, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0.04) 60%, transparent 100%)',
          border: '1.5px solid rgba(20,184,166,0.25)',
        }}
      >
        {/* Halo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 70%)',
          }}
        />
        {/* Bracket SVG décoratif */}
        <svg viewBox="0 0 160 60" className="absolute bottom-0 left-0 right-0 w-full opacity-[0.07]" aria-hidden>
          {[10,10,40,40].map((y,i) => (
            <line key={i} x1={14+(i%2)*24} y1={y} x2={38+(i%2)*24} y2={y} stroke="#14b8a6" strokeWidth="2" strokeLinecap="round"/>
          ))}
          <line x1={38} y1={10} x2={38} y2={40} stroke="#14b8a6" strokeWidth="2"/>
          <line x1={62} y1={10} x2={62} y2={40} stroke="#14b8a6" strokeWidth="2"/>
          <line x1={38} y1={25} x2={80} y2={25} stroke="#14b8a6" strokeWidth="2" strokeLinecap="round"/>
          <line x1={62} y1={25} x2={100} y2={25} stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round"/>
          <text x={112} y={30} fontSize="16" textAnchor="middle">🏆</text>
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(20,184,166,0.15)', border: '1.5px solid rgba(20,184,166,0.3)' }}
          >
            <span className="text-2xl">⚔️</span>
          </div>
          <h1 className="font-display text-xl font-black text-text-strong tracking-tight">
            {t('tournois.createPage.heroTitle')}
          </h1>
          <p className="text-xs text-muted-2 font-medium">{t('tournois.createPage.heroSub')}</p>
        </div>
      </motion.div>

      {/* ── Formulaire ── */}
      <div className="flex flex-col gap-6">

        {/* Nom */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.08 }}
        >
          <label className="block text-[11px] uppercase tracking-widest text-muted font-bold mb-3">
            {t('tournois.field.name')}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={t('tournois.createPage.namePlaceholder')}
            autoFocus
            maxLength={60}
            className="w-full px-4 py-4 bg-bg-1 border-2 border-border rounded-2xl text-base font-semibold focus:border-teal outline-none text-text-strong placeholder:text-muted/50 transition-all allow-select"
          />
          {name.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] text-muted-2 mt-1.5 text-right"
            >
              {name.length}/60
            </motion.p>
          )}
        </motion.div>

        {/* Capacité */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.14 }}
        >
          <label className="block text-[11px] uppercase tracking-widest text-muted font-bold mb-3">
            {t('tournois.field.players')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([8, 16] as Capacity[]).map((c) => {
              const active = capacity === c;
              return (
                <motion.button
                  key={c}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { haptic('selection'); setCapacity(c); }}
                  className={`relative flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 tap-transparent transition-all overflow-hidden ${
                    active
                      ? 'border-teal bg-teal/[0.08]'
                      : 'border-border/60 bg-bg-1/50'
                  }`}
                >
                  {active && (
                    <div className="absolute inset-0 pointer-events-none" style={{
                      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 70%)',
                    }} />
                  )}
                  {/* Silhouettes joueurs */}
                  <div className="flex items-end gap-0.5 relative z-10">
                    {Array.from({ length: Math.min(c, 6) }).map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-full transition-all ${active ? 'bg-teal' : 'bg-muted-2/40'}`}
                        style={{
                          width: 5,
                          height: 12 + (i % 2) * 4,
                          opacity: active ? 0.7 + (i % 2) * 0.3 : 0.4,
                        }}
                      />
                    ))}
                    {c > 6 && (
                      <span className={`text-[9px] font-black ml-0.5 relative z-10 ${active ? 'text-teal' : 'text-muted-2'}`}>
                        +{c - 6}
                      </span>
                    )}
                  </div>
                  <span className={`font-mono font-black text-3xl tabular-nums relative z-10 ${active ? 'text-teal' : 'text-text-strong'}`}>
                    {c}
                  </span>
                  <div className="relative z-10 text-center">
                    <div className={`text-[11px] font-extrabold uppercase tracking-wide ${active ? 'text-teal' : 'text-muted-2'}`}>
                      {t('tournois.mobile.players')}
                    </div>
                    <div className={`text-[10px] font-medium mt-0.5 ${active ? 'text-teal/70' : 'text-muted-2/60'}`}>
                      {c === 8 ? t('tournois.createPage.cap8') : t('tournois.createPage.cap16')}
                    </div>
                  </div>
                  {active && (
                    <motion.div
                      layoutId="capacity-indicator"
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-teal"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <Button
            loading={busy}
            onClick={submit}
            className="w-full py-4 text-[15px] font-extrabold"
            disabled={!canSubmit}
          >
            {t('tournois.modal.submit')}
          </Button>
          <p className="text-[10px] text-muted/50 text-center font-medium leading-relaxed">
            {t('tournois.createPage.footer')}
          </p>
        </motion.div>

      </div>
    </div>
  );
}
