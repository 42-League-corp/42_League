import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { AuthProvider } from './hooks/useAuth';
import { FlashProvider } from './hooks/useFlash';
import { ConfirmProvider } from './hooks/useConfirm';
import { I18nProvider } from './lib/i18n';
import { MotionProvider } from './mobile/motion/MotionProvider';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing in index.html');

// Service Worker — auto-update silencieux. La nouvelle version prendra effet
// au prochain rafraîchissement, sans prompt utilisateur (UX silencieuse iOS-like).
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(rootEl).render(
  <StrictMode>
    <MotionProvider>
      <I18nProvider>
        <AuthProvider>
          <FlashProvider>
            <ConfirmProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ConfirmProvider>
          </FlashProvider>
        </AuthProvider>
      </I18nProvider>
    </MotionProvider>
  </StrictMode>,
);
