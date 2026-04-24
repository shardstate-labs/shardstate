/* SHARDSTATE — public client config.
 * The anon key is PUBLIC by design (Supabase RLS protects data server-side).
 * Never put service_role keys here. */
window.SHS_CONFIG = {
  SUPABASE_URL: 'https://ivtnqwqmhdotsralghjt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2dG5xd3FtaGRvdHNyYWxnaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5OTk1MzEsImV4cCI6MjA5MjU3NTUzMX0.kYLWeqsggagOh7OopyOK_qoZxUm67aFQUgZUPsusGn0',
  // Where to land after Google OAuth. Auto-detects env (localhost vs prod).
  REDIRECT_TO: (function(){
    const p = location.pathname.replace(/[^/]+$/, '');
    return location.origin + p + 'gamehub/index.html';
  })(),
};
