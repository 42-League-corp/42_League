import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../lib/i18n';

export function LoginPage() {
  const t = useT();
  const { startLogin } = useAuth();

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-bg-1/70 border border-border rounded-lg p-6 sm:p-8 backdrop-blur shadow-teal-glow text-center">
        <div className="text-3xl font-extrabold tracking-[0.22em] uppercase bg-gradient-to-r from-teal via-white to-gold bg-clip-text text-transparent mb-2">
          42 League
        </div>
        <div className="text-[10px] text-muted-2 uppercase tracking-[0.2em] mb-8">
          Babyfoot · Ranked
        </div>

        <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-teal flex items-center justify-center text-2xl font-extrabold text-teal bg-bg-2 shadow-teal-glow">
          42
        </div>

        <h1 className="text-lg font-bold text-text-strong mb-3">{t('anon.title')}</h1>
        <p className="text-sm text-muted-2 leading-relaxed mb-6">{t('anon.text')}</p>

        <Button onClick={startLogin} full size="md">
          {t('anon.cta')}
        </Button>
      </div>
    </main>
  );
}
