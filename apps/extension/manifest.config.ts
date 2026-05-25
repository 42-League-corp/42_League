import { defineManifest } from '@crxjs/vite-plugin';

const ICON = 'icons/42_league.png';

export default defineManifest({
  manifest_version: 3,
  name: '42 League',
  version: '0.0.1',
  description: 'Ranked babyfoot pour les étudiants 42 — déclare et confirme tes matchs depuis l\'intra.',
  icons: {
    16: ICON,
    32: ICON,
    48: ICON,
    128: ICON,
  },
  action: {
    default_title: '42 League',
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: ICON,
      32: ICON,
      48: ICON,
      128: ICON,
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  permissions: ['storage', 'identity'],
  host_permissions: [
    'https://intra.42.fr/*',
    'https://*.intra.42.fr/*',
    'https://api.intra.42.fr/*',
    'http://localhost:3000/*',
    'http://localhost:5173/*',
  ],
  content_scripts: [
    {
      matches: ['https://intra.42.fr/*', 'https://*.intra.42.fr/*'],
      js: ['src/content/intra.ts'],
      run_at: 'document_idle',
    },
    {
      matches: ['https://profile.intra.42.fr/users/*'],
      js: ['src/content/intra-profile.ts'],
      run_at: 'document_idle',
    },
  ],
});