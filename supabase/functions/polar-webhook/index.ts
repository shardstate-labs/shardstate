// SHARDSTATE — Polar.sh webhook handler (Phase 4).
//
// Deploy URL (production):
//   https://ivtnqwqmhdotsralghjt.supabase.co/functions/v1/polar-webhook
//
// Required secrets (set via `supabase secrets set …`):
//   SUPABASE_URL                 (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-provided)
//   POLAR_WEBHOOK_SECRET         (from Polar dashboard → Webhooks → Signing secret)
//
// Polar dashboard config:
//   - Add webhook → URL: <deploy URL above>
//   - Subscribe to: order.created, order.refunded
//   - Enable signing → copy the secret into POLAR_WEBHOOK_SECRET
//
// Product mapping (set in Polar dashboard, name MUST match exactly):
//   - "BP_PREMIUM" → grants Battle Pass Premium ($20 one-shot)
//   - "FLUX_5"     → +5  FLUX
//   - "FLUX_10"    → +10 FLUX
//   - "FLUX_30"    → +30 FLUX
//   - "FLUX_50"    → +50 FLUX
//
// At checkout time the frontend (js/payments.js) MUST attach `metadata.shs_uid`
// equal to the Supabase user.id so this handler can resolve the recipient.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL  = Deno.env.get('SUPABASE_URL')!;
const SB_SVC  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET  = Deno.env.get('POLAR_WEBHOOK_SECRET') || '';

const sb = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } });

const FLUX_GRANTS: Record<string, number> = {
  FLUX_5:  5,
  FLUX_10: 10,
  FLUX_30: 30,
  FLUX_50: 50,
};

// ── HMAC-SHA256 signature verification ──────────────────────────────
// Polar signs the raw body with the webhook secret. We compute HMAC and
// compare in constant time. Header name: `polar-signature` (hex).
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!SECRET || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(hex, signature.toLowerCase().replace(/^sha256=/, ''));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const sig  = req.headers.get('polar-signature') || req.headers.get('webhook-signature') || '';
  const body = await req.text();

  if (!await verifySignature(body, sig)) {
    return new Response('invalid signature', { status: 401 });
  }

  let evt: any;
  try { evt = JSON.parse(body); }
  catch { return new Response('invalid json', { status: 400 }); }

  // Polar event envelope: { type, data: { ... } }
  const type = evt?.type || '';
  const data = evt?.data || {};

  // Resolve user + product (defensive: Polar payload shape can vary by version).
  const userId  = data?.metadata?.shs_uid || data?.customer?.metadata?.shs_uid || null;
  const product = data?.product?.name      || data?.product_name              || data?.items?.[0]?.product?.name || '';
  const orderId = data?.id                  || data?.order_id                 || '';
  const amount  = data?.amount              ?? data?.total_amount             ?? 0;
  const ccy     = data?.currency            || 'USD';

  if (!userId || !product || !orderId) {
    return new Response(JSON.stringify({ ignored: 'missing fields', type }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  if (type === 'order.created' || type === 'checkout.completed') {
    // Idempotent insert (UNIQUE on provider + provider_id).
    const { error: insErr } = await sb.from('purchases').insert({
      user_id:      userId,
      provider:     'polar',
      provider_id:  orderId,
      product_id:   product,
      amount_cents: amount | 0,
      currency:     ccy,
      status:       'paid',
      raw:          data,
      paid_at:      new Date().toISOString(),
    });
    // Duplicate = already processed; treat as success.
    if (insErr && !String(insErr.message || '').includes('duplicate')) {
      console.error('purchase insert failed', insErr);
      return new Response('db error', { status: 500 });
    }
    if (insErr) return new Response(JSON.stringify({ ok: true, dedup: true }), { status: 200 });

    // Look up the row we just inserted to use its id as source_purchase.
    const { data: purch } = await sb.from('purchases')
      .select('id').eq('provider', 'polar').eq('provider_id', orderId).maybeSingle();
    const purchaseId = purch?.id || null;

    // Grant entitlements based on product.
    if (product === 'BP_PREMIUM') {
      await sb.rpc('grant_bp_premium', { p_uid: userId });
      await sb.from('entitlements').insert({
        user_id: userId, kind: 'bp_premium', value_int: 1, source_purchase: purchaseId,
      });
    } else if (FLUX_GRANTS[product] != null) {
      const flux = FLUX_GRANTS[product];
      await sb.rpc('grant_flux', { p_uid: userId, p_amount: flux });
      await sb.from('entitlements').insert({
        user_id: userId, kind: 'flux_credits', value_int: flux, source_purchase: purchaseId,
      });
    } else {
      console.warn('unknown product', product);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }

  if (type === 'order.refunded') {
    await sb.from('purchases')
      .update({ status: 'refunded' })
      .eq('provider', 'polar').eq('provider_id', orderId);
    // Note: we do NOT auto-claw-back FLUX/premium. Manual review per refund.
    return new Response(JSON.stringify({ ok: true, refunded: orderId }), { status: 200 });
  }

  return new Response(JSON.stringify({ ignored: type }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
});
