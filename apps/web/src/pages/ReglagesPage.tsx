import { Panel } from '../components/Panel';
import { Pills } from '../components/Pills';
import { Button } from '../components/Button';
import { useAuth } from '../hooks/useAuth';
import { useFlash } from '../hooks/useFlash';
import { useI18n, useT, type Lang } from '../lib/i18n';

export function ReglagesPage() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { signOut, startLogin, login } = useAuth();
  const flash = useFlash();

  return (
    <Panel title={t('panel.settings.title')}>
      <div className="flex flex-col gap-6">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-2 mb-2">
            {t('settings.lang')}
          </label>
          <Pills<Lang>
            value={lang}
            onChange={setLang}
            choices={[
              { value: 'fr', label: t('settings.lang.fr') },
              { value: 'en', label: t('settings.lang.en') },
            ]}
          />
        </div>

        <div className="border-t border-border/60 pt-5">
          <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-text-strong mb-3">
            {t('settings.account')}
          </div>
          {login && (
            <div className="text-sm text-muted-2 mb-3">
              Connecté en tant que <span className="text-teal font-semibold">{login}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                signOut();
                startLogin();
              }}
            >
              {t('settings.changeAccount')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                signOut();
                flash.show(t('settings.loggedOut'));
              }}
            >
              {t('settings.logout')}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
