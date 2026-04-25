/* SHARDSTATE — Sync layer (localStorage ↔ Supabase Postgres).
 *
 * Exposes window.SHS_SYNC with:
 *   SHS_SYNC.queueState(uid, gameStatePatch)  → debounced push to game_state
 *   SHS_SYNC.queueDeck(uid, name, cardIds, isActive)  → push to decks
 *   SHS_SYNC.queueCollection(uid, collectionMap)  → diffs vs last snapshot, upserts cards_owned
 *   SHS_SYNC.queueProfile(uid, profilePatch)  → push to profiles
 *   SHS_SYNC.flush(uid)  → force-flush right now (returns Promise)
 *   SHS_SYNC.reportBattle(uid, battle)  → insert into battles
 *
 * Offline behavior:
 *   - Failed pushes are stored in localStorage key `shs_sync_queue` as the
 *     "latest desired state" per (uid, table). On next push (debounce tick or
 *     `online` event) we retry. Collection writes are stored as a full map
 *     so the latest one wins.
 */
(function(){
  if (window.SHS_SYNC) return;

  const QKEY = 'shs_sync_queue';
  const COL_SNAP_KEY = 'shs_collection_snapshot'; // last-known DB snapshot per uid
  const DEBOUNCE_MS = 1500;

  /** queue layout in localStorage:
   *  {
   *    [uid]: {
   *      gameState: {...patch},
   *      profile:   {...patch},
   *      decks:     { [name]: {name, cardIds, isActive} },
   *      collection:{ [cardId]: qty }
   *    }
   *  }
   */
  function loadQueue(){ try{ return JSON.parse(localStorage.getItem(QKEY)||'{}'); } catch(_){ return {}; } }
  function saveQueue(q){ try{ localStorage.setItem(QKEY, JSON.stringify(q)); } catch(_){} }
  function loadColSnap(uid){ try{ return JSON.parse(localStorage.getItem(COL_SNAP_KEY+':'+uid)||'{}'); } catch(_){ return {}; } }
  function saveColSnap(uid, snap){ try{ localStorage.setItem(COL_SNAP_KEY+':'+uid, JSON.stringify(snap)); } catch(_){} }

  function ensureBucket(q, uid){
    if(!q[uid]) q[uid] = { gameState:null, profile:null, decks:{}, collection:null };
    return q[uid];
  }

  let _timer = null;
  function schedule(){
    if (_timer) return;
    _timer = setTimeout(() => { _timer = null; flushAll().catch(()=>{}); }, DEBOUNCE_MS);
  }

  async function flushAll(){
    if(!window.SB) return;
    const sb = await SB.client();
    const q = loadQueue();
    for (const uid of Object.keys(q)){
      const bucket = q[uid];

      // 1) game_state (single row keyed by user_id)
      if (bucket.gameState && Object.keys(bucket.gameState).length){
        const patch = Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, bucket.gameState);
        const { error } = await sb.from('game_state').upsert(patch, { onConflict:'user_id' });
        if (!error) bucket.gameState = null;
      }

      // 2) profile
      if (bucket.profile && Object.keys(bucket.profile).length){
        const patch = Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, bucket.profile);
        const { error } = await sb.from('profiles').upsert(patch, { onConflict:'user_id' });
        if (!error) bucket.profile = null;
      }

      // 3) decks (one row per (uid, name))
      if (bucket.decks && Object.keys(bucket.decks).length){
        for (const name of Object.keys(bucket.decks)){
          const d = bucket.decks[name];
          if (!d || !Array.isArray(d.cardIds) || d.cardIds.length !== 8) continue;
          // Find existing by name
          const { data: existing } = await sb.from('decks').select('id').eq('user_id', uid).eq('name', name).maybeSingle();
          const row = {
            user_id: uid, name,
            card_ids: d.cardIds, is_active: !!d.isActive,
            updated_at: new Date().toISOString(),
          };
          if (existing && existing.id) row.id = existing.id;
          const { error } = await sb.from('decks').upsert(row);
          if (!error) delete bucket.decks[name];
        }
        if (Object.keys(bucket.decks).length === 0) bucket.decks = {};
      }

      // 4) collection diff vs snapshot
      if (bucket.collection){
        const desired = bucket.collection;
        const snap = loadColSnap(uid);
        const desiredIds = Object.keys(desired);
        const snapIds = Object.keys(snap);
        // Safety rail: collection sync is the only path that can delete
        // ownership rows. A stale localStorage snapshot plus an empty in-memory
        // collection can otherwise wipe cards_owned after unrelated deck edits.
        // Selling/listing enforces keeping at least 8 cards, so a client state
        // below that threshold is treated as non-authoritative for deletes.
        const allowDeletes = desiredIds.length >= 8 || snapIds.length === 0;
        const upserts = [];
        const deletes = [];
        const allIds = new Set([...desiredIds, ...snapIds]);
        for (const cid of allIds){
          const want = desired[cid] || 0;
          const have = snap[cid]    || 0;
          if (want > 0 && want !== have){
            upserts.push({ user_id: uid, card_id: cid, qty: want });
          } else if (allowDeletes && want === 0 && have > 0){
            deletes.push(cid);
          }
        }
        let ok = true;
        if (upserts.length){
          const { error } = await sb.from('cards_owned').upsert(upserts, { onConflict:'user_id,card_id' });
          if (error) ok = false;
        }
        if (ok && deletes.length){
          const { error } = await sb.from('cards_owned').delete().eq('user_id', uid).in('card_id', deletes);
          if (error) ok = false;
        }
        if (ok){
          saveColSnap(uid, desired);
          bucket.collection = null;
        }
      }
    }
    saveQueue(q);
  }

  // Retry on coming back online.
  window.addEventListener('online', () => { flushAll().catch(()=>{}); });

  window.SHS_SYNC = {
    queueState(uid, patch){
      if (!uid || !patch) return;
      const q = loadQueue();
      const b = ensureBucket(q, uid);
      b.gameState = Object.assign(b.gameState || {}, patch);
      saveQueue(q); schedule();
    },
    queueProfile(uid, patch){
      if (!uid || !patch) return;
      const q = loadQueue();
      const b = ensureBucket(q, uid);
      b.profile = Object.assign(b.profile || {}, patch);
      saveQueue(q); schedule();
    },
    queueDeck(uid, name, cardIds, isActive){
      if (!uid || !name || !Array.isArray(cardIds)) return;
      const q = loadQueue();
      const b = ensureBucket(q, uid);
      b.decks[name] = { name, cardIds: cardIds.slice(0, 8), isActive: !!isActive };
      saveQueue(q); schedule();
    },
    /** Hard-delete a deck row by name (server-side). Removes from queue too. */
    async deleteDeck(uid, name){
      if (!window.SB || !uid || !name) return;
      try {
        const sb = await SB.client();
        await sb.from('decks').delete().eq('user_id', uid).eq('name', name);
        const q = loadQueue();
        const b = q[uid];
        if (b && b.decks && b.decks[name]) { delete b.decks[name]; saveQueue(q); }
      } catch(e){ console.warn('deleteDeck failed:', e); }
    },
    /** Force a fresh push of the entire collection (treats DB as empty). */
    forceCollectionResync(uid){
      if (!uid) return;
      try { localStorage.removeItem(COL_SNAP_KEY+':'+uid); } catch(_){}
    },
    queueCollection(uid, collectionMap){
      if (!uid || !collectionMap) return;
      const q = loadQueue();
      const b = ensureBucket(q, uid);
      b.collection = Object.assign({}, collectionMap);
      saveQueue(q); schedule();
    },
    async reportBattle(uid, battle){
      if (!window.SB || !uid || !battle) return;
      try {
        const sb = await SB.client();
        await sb.from('battles').insert(Object.assign({ user_id: uid }, battle));
      } catch(e){ console.warn('reportBattle failed:', e); }
    },
    /** Server-authoritative battle finalization.
     *  Calls public.finalize_battle RPC: server computes rewards
     *  (shards/xp/elo) atomically + writes to battles + missions
     *  + battle_pass.
     *  payload: { mode, result, opponent_name?, rounds? }
     *  Returns the rewards object on success, or null on failure.
     */
    async finalizeBattle(payload){
      if (!window.SB || !payload) return null;
      try {
        const sb = await SB.client();
        const { data, error } = await sb.rpc('finalize_battle', {
          p_mode:          payload.mode,
          p_result:        payload.result,
          p_opponent_name: payload.opponent_name || null,
          p_rounds:        payload.rounds || [],
        });
        if (error) { console.warn('finalize_battle RPC error:', error); return null; }
        return data;
      } catch(e){ console.warn('finalizeBattle failed:', e); return null; }
    },
    flush: () => flushAll(),
  };

  // Best-effort: try a flush on first idle.
  setTimeout(() => flushAll().catch(()=>{}), 500);
})();
