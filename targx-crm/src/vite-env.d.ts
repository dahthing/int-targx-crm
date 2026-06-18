/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NG_APP_SUPABASE_URL?: string;
  readonly NG_APP_SUPABASE_ANON_KEY?: string;
  readonly NG_APP_URL?: string;
  readonly NG_APP_CLIENT_PORTAL_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
