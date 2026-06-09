import { defineManifest } from '@crxjs/vite-plugin';

const ICON = 'icons/42_league.png';

export default defineManifest({
  manifest_version: 3,
  name: '42 League',
  version: '0.0.5',
  description:
    '42 League — badges ELO sur les profils intra + raccourci vers la web app.',
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
  // Source = manifest Chrome MV3 (service_worker only). Chrome REFUSE la clé
  // `background.scripts` ('requires manifest version 2 or lower'). La variante
  // Firefox (event page `scripts`) est générée séparément par patch-manifest.js
  // dans dist-firefox/ — voir ce script.
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  browser_specific_settings: {
    gecko: {
      id: '42league@oneleague.fr',
      strict_min_version: '140.0',
      data_collection_permissions: { required: [] },
    },
  },
  permissions: ['storage', 'identity', 'tabs'],
  host_permissions: [
    'https://intra.42.fr/*',
    'https://*.intra.42.fr/*',
    'https://api.intra.42.fr/*',
    'https://oneleague.fr/*',
    ...(process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000/*', 'http://localhost:5173/*']
      : []),
  ],
  web_accessible_resources: [
    {
      resources: [
        'icons/baby-raccourci-logo-intra.png',
        'icons/baby-raccourci-logo-intra-hover.png'
      ],
      matches: ['https://intra.42.fr/*', 'https://*.intra.42.fr/*'],
    },
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