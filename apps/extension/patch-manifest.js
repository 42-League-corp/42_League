import { readFileSync, writeFileSync, rmSync, cpSync } from 'fs';

// Vite/crxjs émet un manifest Chrome MV3 (background.service_worker) dans dist/.
// Chrome REFUSE `background.scripts` ('requires manifest version 2 or lower') et
// Firefox MV3 n'exécute PAS de service_worker par défaut : il lui faut un event
// page `background.scripts`. Les deux sont donc incompatibles dans un seul
// manifeste → on produit deux cibles :
//   - dist/          : Chrome (service_worker only, sans clés gecko)
//   - dist-firefox/  : Firefox (background.scripts + browser_specific_settings)

const CHROME_DIR = 'dist';
const FIREFOX_DIR = 'dist-firefox';
const CHROME_MANIFEST = `${CHROME_DIR}/manifest.json`;
const FIREFOX_MANIFEST = `${FIREFOX_DIR}/manifest.json`;

const base = JSON.parse(readFileSync(CHROME_MANIFEST, 'utf8'));

// ── Manifeste Firefox (event page `scripts`) ─────────────────────────────────
const firefox = JSON.parse(JSON.stringify(base));
const swEntry = firefox.background?.service_worker;
firefox.background = {
  scripts: swEntry ? [swEntry] : [],
  type: 'module',
};
firefox.browser_specific_settings = firefox.browser_specific_settings ?? {};
firefox.browser_specific_settings.gecko =
  firefox.browser_specific_settings.gecko ?? {};
firefox.browser_specific_settings.gecko.data_collection_permissions = {
  required: ['none'],
  optional: [],
};
delete firefox.data_collection_permissions;

rmSync(FIREFOX_DIR, { recursive: true, force: true });
cpSync(CHROME_DIR, FIREFOX_DIR, { recursive: true });
writeFileSync(FIREFOX_MANIFEST, JSON.stringify(firefox, null, 2));

// ── Manifeste Chrome (on retire les clés gecko, ignorées + warning sur Chrome) ─
delete base.browser_specific_settings;
writeFileSync(CHROME_MANIFEST, JSON.stringify(base, null, 2));

console.log(`Chrome  → ${CHROME_MANIFEST} (service_worker)`);
console.log(`Firefox → ${FIREFOX_MANIFEST} (background.scripts)`);
