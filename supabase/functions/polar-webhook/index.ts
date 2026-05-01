// SHARDSTATE - Polar webhook handler.
//
// Deploy URL:
//   https://ivtnqwqmhdotsralghjt.supabase.co/functions/v1/polar-webhook
//
// Required secrets:
//   SUPABASE_URL                 (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-provided)
//   POLAR_WEBHOOK_SECRET         (Polar webhook signing secret)
//
// Polar dashboard config:
//   - Delivery format: Raw
//   - Subscribe to: order.paid, order.refunded

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('POLAR_WEBHOOK_SECRET') || '';

const sb = createClient(SB_URL, SB_SVC, { auth: { persistSession: false } });

const FLUX_GRANTS: Record<string, number> = {
  FLUX_5: 5,
  FLUX_10: 10,
  FLUX_30: 30,
  FLUX_50: 50,
};

async function verifySignature(body: string, headers: Headers): Promise<boolean> {
  const id = headers.get('webhook-id') || '';
  const timestamp = headers.get('webhook-timestamp') || '';
  const signature = headers.get('webhook-signature') || '';
  if (!SECRET || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 10 * 60) return false;

  const payload = `${id}.${timestamp}.${body}`;
  const signatures = signature
    .split(/\s+/)
    .flatMap(part => part.split(','))
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.startsWith('v1,') ? part.slice(3) : part)
    .map(part => part.startsWith('v1=') ? part.slice(3) : part)
    .filter(Boolean);

  for (const keyBytes of secretCandidates(SECRET)) {
    const digest = await hmacBase64(keyBytes, payload);
    if (signatures.some(sig => timingSafeEqual(digest, sig))) return true;
  }
  return false;
}

async function hmacBase64(keyBytes: Uint8Array, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function secretCandidates(secret: string): Uint8Array[] {
  const enc = new TextEncoder();
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const candidates = [enc.encode(secret)];
  if (raw !== secret) candidates.push(enc.encode(raw));
  try {
    const bin = atob(raw);
    candidates.push(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } catch {
    // Not base64; the UTF-8 candidates above are enough.
  }
  return candidates;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function resolveProduct(data: any): string {
  return String(
    data?.metadata?.shs_product ||
    data?.checkout?.metadata?.shs_product ||
    data?.product?.name ||
    data?.product_name ||
    data?.items?.[0]?.product?.name ||
    '',
  );
}

function resolveUserId(data: any): string {
  return String(
    data?.metadata?.shs_uid ||
    data?.checkout?.metadata?.shs_uid ||
    data?.customer?.metadata?.shs_uid ||
    data?.customer?.external_id ||
    '',
  );
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const body = await req.text();
  if (!await verifySignature(body, req.headers)) {
    return new Response('invalid signature', { status: 401 });
  }

  let evt: any;
  try { evt = JSON.parse(body); }
  catch { return new Response('invalid json', { status: 400 }); }

  const type = evt?.type || '';
  const data = evt?.data || {};
  const userId = resolveUserId(data);
  const product = resolveProduct(data);
  const orderId = data?.id || data?.order_id || data?.order?.id || '';
  const amount = data?.amount ?? data?.total_amount ?? data?.net_amount ?? 0;
  const ccy = data?.currency || 'USD';

  if (!userId || !product || !orderId) {
    return json({ ignored: 'missing_fields', type });
  }

  if (type === 'order.paid' || type === 'checkout.completed') {
    const { error: insErr } = await sb.from('purchases').insert({
      user_id: userId,
      provider: 'polar',
      provider_id: orderId,
      product_id: product,
      amount_cents: amount | 0,
      currency: ccy,
      status: 'paid',
      raw: data,
      paid_at: new Date().toISOString(),
    });

    if (insErr && !String(insErr.message || '').includes('duplicate')) {
      console.error('purchase insert failed', insErr);
      return new Response('db error', { status: 500 });
    }
    if (insErr) return json({ ok: true, dedup: true });

    const { data: purch } = await sb.from('purchases')
      .select('id')
      .eq('provider', 'polar')
      .eq('provider_id', orderId)
      .maybeSingle();
    const purchaseId = purch?.id || null;

    if (product === 'BP_PREMIUM') {
      await sb.rpc('grant_bp_premium', { p_uid: userId });
      await sb.from('entitlements').insert({
        user_id: userId,
        kind: 'bp_premium',
        value_int: 1,
        source_purchase: purchaseId,
      });
    } else if (FLUX_GRANTS[product] != null) {
      const flux = FLUX_GRANTS[product];
      await sb.rpc('grant_flux', { p_uid: userId, p_amount: flux });
      await sb.from('entitlements').insert({
        user_id: userId,
        kind: 'flux_credits',
        value_int: flux,
        source_purchase: purchaseId,
      });
      await sb.rpc('grant_referral_flux_once', { p_referred_uid: userId, p_purchase_id: purchaseId });
    } else {
      console.warn('unknown product', product);
    }

    return json({ ok: true });
  }

  if (type === 'order.refunded') {
    await sb.from('purchases')
      .update({ status: 'refunded' })
      .eq('provider', 'polar')
      .eq('provider_id', orderId);
    return json({ ok: true, refunded: orderId });
  }

  return json({ ignored: type });
});
