// SHARDSTATE - Polar checkout session creator.
//
// Required secrets:
//   SUPABASE_URL              (auto-provided)
//   SUPABASE_ANON_KEY         (auto-provided)
//   POLAR_ACCESS_TOKEN        (Polar Organization Access Token, checkouts:write)
//   POLAR_PRODUCT_MAP         JSON map: {"FLUX_5":"uuid","FLUX_10":"uuid",...}
//
// Optional:
//   POLAR_API_BASE            Defaults to https://api.polar.sh

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const POLAR_TOKEN = Deno.env.get('POLAR_ACCESS_TOKEN') || '';
const POLAR_API_BASE = (Deno.env.get('POLAR_API_BASE') || 'https://api.polar.sh').replace(/\/$/, '');

const ALLOWED_PRODUCTS = new Set(['BP_PREMIUM', 'FLUX_5', 'FLUX_10', 'FLUX_30', 'FLUX_50']);
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function productMap(): Record<string, string> {
  try {
    return JSON.parse(Deno.env.get('POLAR_PRODUCT_MAP') || '{}');
  } catch {
    return {};
  }
}

function safeUrl(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {
    // Ignore invalid URLs and use fallback.
  }
  return fallback;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader) return json({ error: 'not_authenticated' }, 401);

  const sb = createClient(SB_URL, SB_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await sb.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return json({ error: 'not_authenticated' }, 401);

  let body: any = {};
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const product = String(body?.product || '');
  if (!ALLOWED_PRODUCTS.has(product)) return json({ error: 'invalid_product' }, 400);

  const map = productMap();
  const productId = map[product];
  if (!POLAR_TOKEN || !productId) return json({ error: 'polar_not_configured' }, 503);

  const fallbackReturnUrl = req.headers.get('origin') || 'https://shardstate.vercel.app';
  const successUrl = safeUrl(body?.success_url, `${fallbackReturnUrl}/gamehub/index.html?paid=1&product=${product}`);
  const returnUrl = safeUrl(body?.return_url, fallbackReturnUrl);

  const polarRes = await fetch(`${POLAR_API_BASE}/v1/checkouts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${POLAR_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      products: [productId],
      external_customer_id: user.id,
      customer_email: user.email || undefined,
      metadata: {
        shs_uid: user.id,
        shs_product: product,
      },
      customer_metadata: {
        shs_uid: user.id,
      },
      success_url: successUrl,
      return_url: returnUrl,
      allow_discount_codes: false,
      require_billing_address: false,
    }),
  });

  const data = await polarRes.json().catch(() => ({}));
  if (!polarRes.ok || !data?.url) {
    console.error('polar checkout failed', polarRes.status, data);
    return json({ error: 'polar_checkout_failed', status: polarRes.status }, 502);
  }

  return json({ ok: true, url: data.url, checkout_id: data.id });
});
