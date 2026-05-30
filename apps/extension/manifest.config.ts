import { defineManifest } from '@crxjs/vite-plugin';

const ICON = 'icons/42_league.png';

export default defineManifest({
  manifest_version: 3,
  name: '42 League',
  version: '0.0.4',
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
  // `service_worker` (Chrome MV3) + `scripts` (Firefox MV3) cohabitent
  // volontairement pour rester cross-browser. La combinaison n'est pas exprimable
  // dans le type strict de defineManifest → on élargit le cast (manifeste émis
  // inchangé).
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
    scripts: ['src/background/index.ts'],
  } as chrome.runtime.ManifestBackground,
  browser_specific_settings: {
    gecko: {
      id: '42league@42league.fr',
      strict_min_version: '140.0',
    },
  } as Record<string, unknown>,
  permissions: ['storage', 'identity', 'tabs'],
  host_permissions: [
    'https://intra.42.fr/*',
    'https://*.intra.42.fr/*',
    'https://api.intra.42.fr/*',
    'http://163.172.141.178:3000/*',
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