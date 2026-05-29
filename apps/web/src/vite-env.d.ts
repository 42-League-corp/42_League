/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

declare const __APP_VERSION__: string;
declare const __APP_DATE__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
