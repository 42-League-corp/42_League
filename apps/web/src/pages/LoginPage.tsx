import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../lib/i18n';

export function LoginPage() {
  const t = useT();
  const { startLogin } = useAuth();

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Vignette + grille HUD */}
      <div className="absolute inset-0 bg-gold-vignette pointer-events-none" />
      <div className="absolute inset-0 hud-grid opacity-50 pointer-events-none" />

      <div
        className="relative max-w-md w-full card-hud rounded-2xl p-6 sm:p-8 text-center overflow-hidden"
        style={{
          border: '1px solid rgba(255,201,74,0.4)',
          boxShadow:
            '0 24px 56px rgba(0,0,0,0.65), 0 0 60px rgba(255,201,74,0.18), inset 0 1px 0 rgba(255,215,120,0.15)',
        }}
      >
        {/* Tubes laiton en haut et en bas */}
        <div className="absolute top-0 left-6 right-6 h-[2px] brass-pipe rounded-full" />
        <div className="absolute bottom-0 left-6 right-6 h-[2px] brass-pipe rounded-full" />

        <div className="relative">
          <div className="font-display text-3xl font-black tracking-[0.22em] uppercase gradient-text-brand mb-2">
            42 League
          </div>
          <div className="text-[10px] text-brass/80 uppercase tracking-[0.22em] mb-8 font-extrabold">
            Babyfoot · Ranked
          </div>

          <div
            className="relative w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center font-display text-3xl font-black animate-glow-pulse metal-plate-gold"
          >
            <span className="text-[#1a1100]">42</span>
          </div>

          <h1 className="font-gaming text-xl font-extrabold text-text-strong mb-3 uppercase tracking-wide">
            {t('anon.title')}
          </h1>
          <p className="text-sm text-muted-2 leading-relaxed mb-6">{t('anon.text')}</p>

          <Button onClick={startLogin} full size="lg">
            {t('anon.cta')}
          </Button>
        </div>
      </div>
    </main>
  );
}
