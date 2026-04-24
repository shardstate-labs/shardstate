/* SHARDSTATE — Supabase client wrapper.
 * Single global: window.SB
 *
 * Loads supabase-js v2 from CDN and exposes a small surface area
 * the PWA uses for auth + profile sync. RLS enforces that any
 * authenticated request only touches the calling user's rows.
 *
 * Designed to coexist with the existing localStorage AUTH layer:
 * we mirror Supabase profile data into the legacy shape so the
 * rest of the codebase keeps working unchanged during migration.
 */
(function(){
  if (window.SB) return; // idempotent

  const cfg = window.SHS_CONFIG || {};
  const URL_KEY = cfg.SUPABASE_URL;
  const ANON    = cfg.SUPABASE_ANON_KEY;

  // ── Lazy CDN loader for @supabase/supabase-js v2 ──────────────
  let _clientPromise = null;
  function ensureClient(){
    if (_clientPromise) return _clientPromise;
    _clientPromise = new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) {
        resolve(window.supabase.createClient(URL_KEY, ANON, {
          auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true },
        }));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.async = true;
      s.onload = () => {
        try {
          const client = window.supabase.createClient(URL_KEY, ANON, {
            auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true },
          });
          resolve(client);
        } catch(e){ reject(e); }
      };
      s.onerror = () => reject(new Error('Failed to load supabase-js from CDN'));
      document.head.appendChild(s);
    });
    return _clientPromise;
  }

  // ── Public API ────────────────────────────────────────────────
  const SB = {
    /** Returns the supabase-js client (loads it if needed). */
    client: ensureClient,

    async getSession(){
      const sb = await ensureClient();
      const { data } = await sb.auth.getSession();
      return data?.session || null;
    },

    async getUser(){
      const sb = await ensureClient();
      const { data } = await sb.auth.getUser();
      return data?.user || null;
    },

    async signUpEmail(email, password){
      const sb = await ensureClient();
      const { data, error } = await sb.auth.signUp({ email, password });
      return { user: data?.user || null, session: data?.session || null, error };
    },

    async signInEmail(email, password){
      const sb = await ensureClient();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      return { user: data?.user || null, session: data?.session || null, error };
    },

    async signInGoogle(redirectTo){
      const sb = await ensureClient();
      const opts = { provider:'google' };
      if (redirectTo || cfg.REDIRECT_TO) {
        opts.options = { redirectTo: redirectTo || cfg.REDIRECT_TO };
      }
      const { data, error } = await sb.auth.signInWithOAuth(opts);
      return { url: data?.url || null, error };
    },

    async signOut(){
      const sb = await ensureClient();
      const { error } = await sb.auth.signOut();
      return { error };
    },

    /** Fires `cb(session)` on every auth state change. */
    async onAuthChange(cb){
      const sb = await ensureClient();
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => cb(session));
      return sub; // caller can unsubscribe via sub.subscription.unsubscribe()
    },

    // ── Profile / game state ────────────────────────────────────
    async loadProfile(uid){
      const sb = await ensureClient();
      const [{ data: profile }, { data: gameState }, { data: bp }] = await Promise.all([
        sb.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('game_state').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('battle_pass').select('*').eq('user_id', uid).maybeSingle(),
      ]);
      return { profile: profile || null, gameState: gameState || null, battlePass: bp || null };
    },

    async upsertProfile(uid, patch){
      const sb = await ensureClient();
      const row = Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, patch);
      const { data, error } = await sb.from('profiles').upsert(row, { onConflict:'user_id' }).select().maybeSingle();
      return { data, error };
    },

    async upsertGameState(uid, patch){
      const sb = await ensureClient();
      const row = Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, patch);
      const { data, error } = await sb.from('game_state').upsert(row, { onConflict:'user_id' }).select().maybeSingle();
      return { data, error };
    },

    /** Load all of the user's saved decks (active + presets). */
    async loadDecks(uid){
      const sb = await ensureClient();
      const { data, error } = await sb.from('decks').select('*').eq('user_id', uid);
      if (error) return [];
      return data || [];
    },

    /** Load the user's owned collection as a {cardId: qty} map. */
    async loadCollection(uid){
      const sb = await ensureClient();
      const { data, error } = await sb.from('cards_owned').select('card_id,qty').eq('user_id', uid);
      if (error) return {};
      const out = {};
      (data || []).forEach(r => { out[r.card_id] = r.qty | 0; });
      return out;
    },

    /** Username uniqueness check. Returns true if available. */
    async usernameAvailable(username, exceptUid){
      const sb = await ensureClient();
      let q = sb.from('profiles').select('user_id', { count:'exact', head:true }).ilike('username', username);
      if (exceptUid) q = q.neq('user_id', exceptUid);
      const { count, error } = await q;
      if (error) return false;
      return (count || 0) === 0;
    },
  };

  window.SB = SB;
})();
