export const environment = {
  production: true,
  supabaseUrl: import.meta.env['NG_APP_SUPABASE_URL'] ?? '',
  supabaseAnonKey: import.meta.env['NG_APP_SUPABASE_ANON_KEY'] ?? '',
  appUrl: import.meta.env['NG_APP_URL'] ?? 'https://crm.targx.com',
  clientPortalBaseUrl:
    import.meta.env['NG_APP_CLIENT_PORTAL_BASE_URL'] ?? 'https://crm.targx.com/client/quotes',
};
