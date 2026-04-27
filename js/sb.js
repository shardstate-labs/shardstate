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
  function normalizeUsername(username){
    return String(username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
  }
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

    async getMyAccountStatus(){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('get_my_account_status');
      if (error) return { status:'active' };
      return data || { status:'active' };
    },

    async loadMyNotifications(){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('load_my_notifications');
      if (error) return [];
      return data || [];
    },

    async acknowledgeNotification(id){
      const sb = await ensureClient();
      const { error } = await sb.from('user_notifications')
        .update({ acknowledged_at:new Date().toISOString() })
        .eq('id', id);
      return { ok:!error, error };
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

    /** Load the user's owned collection. New shape:
     *  { cardId: { qty, lv, xp, instances:[{id,card_id,lv,xp,...}] } }
     *  Falls back to the legacy {cardId: qty} map if the RPC is not present.
     */
    async loadCollection(uid){
      const sb = await ensureClient();
      try {
        const { data: inst, error: instErr } = await sb.rpc('load_my_card_instances');
        if (!instErr && Array.isArray(inst) && inst.length) {
          const out = {};
          inst.forEach(r => {
            const cid = r.card_id;
            if (!cid) return;
            const item = {
              id: r.id,
              instance_id: r.id,
              card_id: cid,
              lv: r.level || 1,
              level: r.level || 1,
              xp: r.xp || 0,
              locked: !!r.locked,
              source: r.source || '',
              acquired_at: r.acquired_at || null,
              updated_at: r.updated_at || null,
            };
            if (!out[cid]) out[cid] = { qty:0, lv:item.lv, level:item.level, xp:item.xp, instances:[] };
            out[cid].qty += 1;
            out[cid].instances.push(item);
            if ((item.lv || 1) > (out[cid].lv || 1) || ((item.lv || 1) === (out[cid].lv || 1) && (item.xp || 0) > (out[cid].xp || 0))) {
              out[cid].lv = item.lv;
              out[cid].level = item.level;
              out[cid].xp = item.xp;
            }
          });
          return out;
        }
      } catch(_){}
      const { data, error } = await sb.from('cards_owned').select('card_id,qty').eq('user_id', uid);
      if (error) return {};
      const out = {};
      (data || []).forEach(r => { out[r.card_id] = r.qty | 0; });
      return out;
    },

    /** Username uniqueness check. Returns true if available. */
    async usernameAvailable(username, exceptUid){
      const sb = await ensureClient();
      const u = normalizeUsername(username);
      if (!/^[a-z0-9_]{3,16}$/.test(u)) return false;
      let q = sb.from('profiles').select('user_id', { count:'exact', head:true }).eq('username', u);
      if (exceptUid) q = q.neq('user_id', exceptUid);
      const { count, error } = await q;
      if (error) return false;
      return (count || 0) === 0;
    },
    async findProfileByUsername(username){
      const sb = await ensureClient();
      const u = normalizeUsername(username);
      if (!u) return null;
      const { data, error } = await sb.from('profiles')
        .select('user_id,username,display_name,avatar_url,referral_code')
        .eq('username', u)
        .maybeSingle();
      if (error) return null;
      return data || null;
    },
    async findProfileByReferralCode(code){
      const sb = await ensureClient();
      const c = String(code || '').trim();
      if (!c) return null;
      const { data, error } = await sb.from('profiles')
        .select('user_id,username,display_name,avatar_url,referral_code')
        .eq('referral_code', c)
        .maybeSingle();
      if (error) return null;
      return data || null;
    },

    // ── Market ──────────────────────────────────────────────────
    /** Active listings from OTHER players (RLS exposes status='active' to all). */
    async loadMarketActive(excludeUid){
      const sb = await ensureClient();
      let q = sb.from('market_listings').select('id,seller_uid,card_id,price,currency,listed_at')
        .eq('status','active').order('listed_at', { ascending:false }).limit(200);
      if (excludeUid) q = q.neq('seller_uid', excludeUid);
      const { data, error } = await q;
      if (error) return [];
      return data || [];
    },
    async loadMyListings(uid){
      const sb = await ensureClient();
      const { data, error } = await sb.from('market_listings').select('*')
        .eq('seller_uid', uid).order('listed_at', { ascending:false }).limit(200);
      if (error) return [];
      return data || [];
    },
    async loadMarketPurchases(uid){
      const sb = await ensureClient();
      const { data, error } = await sb.from('market_listings').select('*')
        .eq('buyer_uid', uid).eq('status','sold').order('sold_at', { ascending:false }).limit(200);
      if (error) return [];
      return data || [];
    },
    async listCardForSale(cardId, price){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('list_card_for_sale', { p_card_id:cardId, p_price:price|0 });
      if (error) return { error };
      return data || { error:'unknown' };
    },
    async delistMarketCard(listingId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('delist_card', { p_listing_id:listingId });
      if (error) return { error };
      return data || { error:'unknown' };
    },
    async buyMarketListing(listingId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('buy_listing', { p_listing_id:listingId });
      if (error) return { error };
      return data || { error:'unknown' };
    },

    // ── Battle pass ─────────────────────────────────────────────
    async searchProfiles(query){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('search_profiles', { p_query:String(query||'') });
      if (error) return { error, data:[] };
      return { data:data || [] };
    },
    async getProfileCard(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('profile_card', { p_uid:userId });
      if (error) return { error };
      return { data:data || null };
    },
    async loadSocialState(){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('load_social_state');
      if (error) return { error, data:{ friends:[], incoming:[], sent:[] } };
      return { data:data || { friends:[], incoming:[], sent:[] } };
    },
    async sendFriendRequest(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('send_friend_request', { p_target:userId });
      if (error) return { error };
      return data || { ok:true };
    },
    async respondFriendRequest(requestId, accept){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('respond_friend_request', { p_request_id:requestId, p_accept:!!accept });
      if (error) return { error };
      return data || { ok:true };
    },
    async removeFriend(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('remove_friend', { p_friend:userId });
      if (error) return { error };
      return data || { ok:true };
    },
    async loadDmThread(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('load_dm_thread', { p_friend:userId });
      if (error) return { error, data:[] };
      return { data:(data || []).reverse() };
    },
    async sendDm(userId, body, gifUrl){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('send_dm', { p_friend:userId, p_body:String(body||''), p_gif_url:gifUrl ? String(gifUrl) : null });
      if (error) return { error };
      return data || { ok:true };
    },
    async loadGuildState(query){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('load_guild_state', { p_query:String(query||'') });
      if (error) return { error, data:{ my_guild:null, guilds:[] } };
      return { data:data || { my_guild:null, guilds:[] } };
    },
    async createGuild(payload){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('create_guild', {
        p_name:String(payload?.name||''),
        p_bio:String(payload?.bio||''),
        p_emoji:String(payload?.emoji||''),
        p_icon_url:String(payload?.icon_url||''),
        p_country:String(payload?.country||''),
      });
      if (error) return { error };
      return data || { ok:true };
    },
    async applyGuild(guildId, message){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('apply_guild', { p_guild:guildId, p_message:String(message||'') });
      if (error) return { error };
      return data || { ok:true };
    },
    async respondGuildApplication(applicationId, accept, response){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('respond_guild_application', {
        p_application:applicationId,
        p_accept:!!accept,
        p_response:String(response||''),
      });
      if (error) return { error };
      return data || { ok:true };
    },

    async loadBattlePass(uid){
      const sb = await ensureClient();
      const { data } = await sb.from('battle_pass').select('*').eq('user_id', uid).maybeSingle();
      return data || null;
    },
    async claimBattlePass(tier, track){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('claim_battle_pass', { p_tier:tier|0, p_track:String(track) });
      if (error) return { error };
      return data || { error:'unknown' };
    },
    async buyBattlePassWithFlux(){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('buy_battle_pass_with_flux');
      if (error) return { error };
      return data || { error:'unknown' };
    },

    // ── Custom cards (admin-authored) ───────────────────────────
    async loadCustomCards(){
      try {
        const sb = await ensureClient();
        const { data, error } = await sb.from('custom_cards')
          .select('id, data, is_published, updated_at')
          .order('updated_at', { ascending:false });
        if (error) { console.warn('loadCustomCards error:', error); return []; }
        return (data || [])
          .filter(r => r.is_published !== false)
          .map(r => Object.assign({}, r.data, { id: r.id, isCustom:true }));
      } catch(e){ console.warn('loadCustomCards failed:', e); return []; }
    },
    async upsertCustomCard(cardId, cardData){
      if (!cardId || !cardData) return { error:{ message:'invalid args' } };
      try {
        const sb = await ensureClient();
        const user = await SB.getUser();
        if (!user) return { error:{ message:'must be logged in' } };
        const row = {
          id: String(cardId),
          data: cardData,
          is_published: true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await sb.from('custom_cards')
          .upsert(row, { onConflict:'id' })
          .select().maybeSingle();
        if (error) return { error };
        return { data };
      } catch(e){ return { error:{ message:e.message } }; }
    },
    async deleteCustomCard(cardId){
      try {
        const sb = await ensureClient();
        const { error } = await sb.from('custom_cards').delete().eq('id', String(cardId));
        if (error) return { error };
        return { ok:true };
      } catch(e){ return { error:{ message:e.message } }; }
    },

    // ── Pack history ────────────────────────────────────────────
    async loadPackHistory(uid, limit){
      const sb = await ensureClient();
      const { data, error } = await sb.from('pack_openings').select('id,pack_id,paid_with,cost,card_ids,opened_at')
        .eq('user_id', uid).order('opened_at', { ascending:false }).limit(limit||20);
      if (error) return [];
      return data || [];
    },
    async recordPackOpening(uid, packId, paidWith, cost, cardIds){
      if (!uid || !packId) return null;
      try {
        const sb = await ensureClient();
        const { data, error } = await sb.from('pack_openings').insert({
          user_id: uid,
          pack_id: String(packId),
          paid_with: String(paidWith||'free'),
          cost: Number(cost||0),
          card_ids: Array.isArray(cardIds) ? cardIds : [],
        }).select().maybeSingle();
        if (error) { console.warn('recordPackOpening error:', error); return null; }
        return data || null;
      } catch(e){ console.warn('recordPackOpening failed:', e); return null; }
    },

    // ── Admin user control ───────────────────────────────────────
    async adminSearchUsers(query){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_search_users', { p_query:String(query||'') });
      if (error) return { error };
      return { data:data || [] };
    },
    async adminGetUserDetail(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_get_user_detail', { p_user_id:userId });
      if (error) return { error };
      return { data:data || {} };
    },
    async adminResetUser(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_reset_user', { p_user_id:userId });
      if (error) return { error };
      return { data };
    },
    async adminSetAccountStatus(userId, status, reason){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_set_account_status', {
        p_user_id:userId,
        p_status:String(status||'active'),
        p_reason:String(reason||''),
      });
      if (error) return { error };
      return { data };
    },
    async adminDeleteUserGameData(userId){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_delete_user_game_data', { p_user_id:userId });
      if (error) return { error };
      return { data };
    },
    async adminGrantCurrency(userId, currency, amount, note){
      const sb = await ensureClient();
      const { data, error } = await sb.rpc('admin_grant_currency', {
        p_user_id:userId,
        p_currency:String(currency||'shards'),
        p_amount:amount|0,
        p_note:String(note||''),
      });
      if (error) return { error };
      return { data };
    },

    // ── Profile mutations ───────────────────────────────────────
    async updateUsername(uid, username){
      const sb = await ensureClient();
      const u = normalizeUsername(username);
      if (!/^[a-z0-9_]{3,16}$/.test(u)) return { error:'invalid_username' };
      const free = await SB.usernameAvailable(u, uid);
      if (!free) return { error:'username_taken' };
      const { data, error } = await sb.from('profiles')
        .upsert({ user_id:uid, username:u, updated_at:new Date().toISOString() }, { onConflict:'user_id' })
        .select().maybeSingle();
      if (error) return { error };
      return { data };
    },
    async updateEmail(newEmail){
      const sb = await ensureClient();
      const { data, error } = await sb.auth.updateUser({ email: String(newEmail||'').trim() });
      if (error) return { error };
      return { user: data?.user || null };
    },
    async updatePassword(newPassword){
      const sb = await ensureClient();
      const { data, error } = await sb.auth.updateUser({ password: String(newPassword||'') });
      if (error) return { error };
      return { user: data?.user || null };
    },
  };
  SB.normalizeUsername = normalizeUsername;

  window.SB = SB;
})();
