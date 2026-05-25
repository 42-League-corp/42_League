import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './hooks/useAuth';
import { FlashProvider } from './hooks/useFlash';
import { ConfirmProvider } from './hooks/useConfirm';
import { I18nProvider } from './lib/i18n';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing in index.html');

createRoot(rootEl).render(
  <StrictMode>
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
  </StrictMode>,
);
