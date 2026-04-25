/* SHARDSTATE — Payments client (Phase 4, Polar.sh).
 *
 * Single global: window.SHS_PAY.
 * Provider: Polar.sh (Merchant of Record). One-shot purchases only.
 *
 * Setup checklist (do this in the Polar dashboard before flipping the UI):
 *   1) Create products with these EXACT names:
 *        BP_PREMIUM   ($9.99)
 *        FLUX_PACK_S  ($1.99)   →  +200 FLUX
 *        FLUX_PACK_M  ($4.99)   →  +650 FLUX
 *        FLUX_PACK_L  ($9.99)   →  +1700 FLUX
 *        FLUX_PACK_XL ($19.99)  →  +4800 FLUX
 *   2) Copy each product's `Buy Link` (https://buy.polar.sh/<org>/<product_slug>)
 *      into POLAR_LINKS below, OR set window.SHS_CONFIG.POLAR_BUY_LINKS to the same map.
 *   3) Configure webhook → URL =
 *        https://ivtnqwqmhdotsralghjt.supabase.co/functions/v1/polar-webhook
 *      Subscribe to `order.created` and `order.refunded`.
 *   4) `supabase secrets set POLAR_WEBHOOK_SECRET=<from polar dashboard>`.
 *   5) `supabase functions deploy polar-webhook`.
 *
 * After purchase, Polar redirects to `success_url`. We pass
 * `?paid=1&product=<id>` so app.js can call refreshFromSupabase() and
 * show a confirmation toast. The webhook has already credited the user
 * by the time the redirect fires (Polar fires the webhook server-side
 * before issuing the redirect).
 */
(function(){
  if (window.SHS_PAY) return;

  // Per-product buy-link map. Populate after creating products in Polar.
  // Override at runtime via window.SHS_CONFIG.POLAR_BUY_LINKS = { ... }.
  const POLAR_LINKS = {
    BP_PREMIUM:   '',
    FLUX_PACK_S:  '',
    FLUX_PACK_M:  '',
    FLUX_PACK_L:  '',
    FLUX_PACK_XL: '',
  };

  function buyLink(product){
    const overrides = (window.SHS_CONFIG && window.SHS_CONFIG.POLAR_BUY_LINKS) || {};
    return overrides[product] || POLAR_LINKS[product] || '';
  }

  function successUrl(product){
    const base = (location.origin + location.pathname).replace(/[^/]+$/, '');
    const u = new URL(base + 'index.html');
    u.searchParams.set('paid', '1');
    u.searchParams.set('product', product);
    return u.toString();
  }

  const SHS_PAY = {
    /** Open a Polar checkout for the given product. Resolves once the new
     *  tab is opened (does NOT wait for payment).
     *  @param {string} product  e.g. 'BP_PREMIUM' | 'FLUX_PACK_M'
     *  @return {Promise<{ok:boolean, error?:string}>}
     */
    async checkout(product){
      if (!window.SB) return { ok:false, error:'no_supabase' };
      const user = await SB.getUser();
      if (!user) return { ok:false, error:'not_authenticated' };

      const link = buyLink(product);
      if (!link) return { ok:false, error:'product_not_configured' };

      const url = new URL(link);
      // Pre-fill checkout + tag the order so the webhook knows who paid.
      if (user.email) url.searchParams.set('customer_email', user.email);
      url.searchParams.set('metadata[shs_uid]', user.id);
      url.searchParams.set('success_url', successUrl(product));

      const win = window.open(url.toString(), '_blank', 'noopener,noreferrer');
      if (!win) {
        // Pop-up blocked → fall back to same-tab navigation.
        location.href = url.toString();
      }
      return { ok:true };
    },

    /** Detect the post-checkout redirect. Returns { paid:true, product } once
     *  per page load if the URL carries `?paid=1`. The caller should then
     *  call refreshFromSupabase() to pick up the just-credited entitlements.
     */
    consumeReturn(){
      try {
        const q = new URLSearchParams(location.search);
        if (q.get('paid') !== '1') return { paid:false };
        const product = q.get('product') || '';
        // Strip the params from the URL so reloads don't re-fire the toast.
        q.delete('paid'); q.delete('product');
        const clean = location.pathname + (q.toString() ? '?' + q : '') + location.hash;
        history.replaceState(null, '', clean);
        return { paid:true, product };
      } catch(_) { return { paid:false }; }
    },
  };

  window.SHS_PAY = SHS_PAY;
})();
