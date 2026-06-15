export const environment = {
  production: true,
  supabaseUrl: process.env['SUPABASE_URL'] ?? '',
  supabaseAnonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
  appUrl: process.env['APP_URL'] ?? 'https://crm.targx.com',
  clientPortalBaseUrl: process.env['CLIENT_PORTAL_BASE_URL'] ?? 'https://crm.targx.com/client/quotes',
};
