export const environment = {
  production: false,
  supabaseUrl: process.env['SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
  appUrl: process.env['APP_URL'] ?? 'http://localhost:4200',
  clientPortalBaseUrl: process.env['CLIENT_PORTAL_BASE_URL'] ?? 'http://localhost:4200/client/quotes',
};
