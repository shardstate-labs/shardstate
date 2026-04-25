/* SHARDSTATE — PvP matchmaking + Realtime move sync (Phase 3).
 *
 * Exposes window.SHS_PVP.
 *
 * Flow:
 *   1) Player A clicks "Find PvP" →
 *        SHS_PVP.findMatch(mode, deck) → returns {queued:true} (no opp yet).
 *        SHS_PVP.watchForMatch(uid, onMatched) listens for INSERT on
 *        public.matches where p1=uid or p2=uid.
 *   2) Player B clicks "Find PvP" →
 *        find_or_join_match RPC pops A off the queue, creates the match,
 *        returns {match_id, side:'p2', opponent_id, opponent_deck}.
 *        Player A's Realtime subscription fires immediately.
 *   3) Both players call SHS_PVP.openMatch(matchId, side) which:
 *        - subscribes to broadcast channel `match:{id}`
 *        - returns send(action) / onMove(cb) / close()
 *   4) On end, the LOSER (or whoever detects end first) calls
 *        SHS_PVP.finalize(matchId, winnerUid, rounds).
 *        finalize_battle is invoked server-side for both players.
 */
(function(){
  if (window.SHS_PVP) return;
  if (!window.SB) { console.warn('SHS_PVP requires window.SB'); }

  let _watcher = null;
  let _channel = null;

  async function rpc(fn, args){
    const sb = await SB.client();
    const { data, error } = await sb.rpc(fn, args || {});
    if (error) throw error;
    return data;
  }

  function subscribeReady(ch){
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; reject(new Error('Realtime subscribe timeout')); }
      }, 8000);
      ch.subscribe(status => {
        if (done) return;
        if (status === 'SUBSCRIBED') {
          done = true;
          clearTimeout(timer);
          resolve(ch);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          done = true;
          clearTimeout(timer);
          reject(new Error('Realtime subscribe failed: ' + status));
        }
      });
    });
  }

  const SHS_PVP = {
    /** Try to pair right now or join the queue. */
    async findMatch(mode, deckIds){
      return rpc('find_or_join_match', { p_mode: mode, p_deck: deckIds });
    },

    async cancelQueue(){
      return rpc('leave_queue');
    },

    /** Listen for any match inserted with us as a participant.
     *  cb(matchRow) fires once. Returns {unsubscribe()}.  */
    async watchForMatch(uid, cb){
      if (_watcher) await _watcher.unsubscribe();
      const sb = await SB.client();
      const ch = sb.channel('mm:'+uid)
        .on('postgres_changes',
            { event:'INSERT', schema:'public', table:'matches',
              filter:`p1_user_id=eq.${uid}` },
            payload => cb(payload.new))
        .on('postgres_changes',
            { event:'INSERT', schema:'public', table:'matches',
              filter:`p2_user_id=eq.${uid}` },
            payload => cb(payload.new));
      await subscribeReady(ch);
      _watcher = {
        unsubscribe: async () => { try { await sb.removeChannel(ch); } catch(_){} _watcher = null; }
      };
      return _watcher;
    },

    /** Subscribe to the per-match broadcast channel.
     *  Returns { send(action), onMove(cb), onStatus(cb), close() }. */
    async openMatch(matchId, side){
      if (_channel) try { await _channel.close(); } catch(_){}
      const sb = await SB.client();
      const moveCbs = [], statusCbs = [];
      const ch = sb.channel('match:'+matchId, { config: { broadcast: { ack:true, self:false } } });
      ch.on('broadcast', { event: 'move' }, ({ payload }) => {
        moveCbs.forEach(fn => { try { fn(payload); } catch(_){} });
      });
      ch.on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'matches', filter:`id=eq.${matchId}` },
        payload => statusCbs.forEach(fn => { try { fn(payload.new); } catch(_){} }));
      await subscribeReady(ch);
      const api = {
        side,
        async send(action){
          const ts = action?.ts || Date.now();
          return ch.send({ type:'broadcast', event:'move', payload:{ side, action, ts } });
        },
        onMove(fn){ moveCbs.push(fn); },
        onStatus(fn){ statusCbs.push(fn); },
        async close(){ try { await sb.removeChannel(ch); } catch(_){} _channel = null; },
      };
      _channel = api;
      return api;
    },

    /** Server-authoritative finalize for a PvP match. */
    async finalize(matchId, winnerUid, rounds){
      return rpc('finalize_pvp_match', {
        p_match_id: matchId,
        p_winner_uid: winnerUid || null,
        p_rounds: rounds || [],
      });
    },

    /** Returns my active match (if any), null otherwise. */
    async myActiveMatch(uid, mode){
      const sb = await SB.client();
      let q = sb.from('matches').select('*')
        .or(`p1_user_id.eq.${uid},p2_user_id.eq.${uid}`)
        .eq('status','active');
      if (mode) q = q.eq('mode', mode);
      const { data } = await q.order('created_at', { ascending:false }).limit(1).maybeSingle();
      return data || null;
    },
  };

  window.SHS_PVP = SHS_PVP;
})();
