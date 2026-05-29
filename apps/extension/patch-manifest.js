import { readFileSync, writeFileSync } from 'fs';

const path = 'dist/manifest.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));

if (manifest.background?.service_worker && !manifest.background.scripts) {
  manifest.background.scripts = [manifest.background.service_worker];
}

if (!manifest.browser_specific_settings) manifest.browser_specific_settings = {};
if (!manifest.browser_specific_settings.gecko) manifest.browser_specific_settings.gecko = {};
manifest.browser_specific_settings.gecko.data_collection_permissions = {
  required: ['none'],
  optional: [],
};
delete manifest.data_collection_permissions;

writeFileSync(path, JSON.stringify(manifest, null, 2));
console.log('manifest.json patched for Firefox.');
