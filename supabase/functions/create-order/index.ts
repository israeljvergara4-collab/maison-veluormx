// Edge Function pública: POST /functions/v1/create-order
// Valida la entrada, verifica Turnstile (si está configurado) y llama a place_order() con service_role.
// El navegador NUNCA manda precios: se calculan en la base de datos.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET');
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const cors = (origin: string) => ({
  'access-control-allow-origin': origin,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
  vary: 'origin',
});
const reply = (body: unknown, status: number, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(origin ? cors(origin) : {}) },
  });

const str = (v: unknown, min: number, max: number) =>
  typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null;

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const originOk = ALLOWED.includes(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: originOk ? cors(origin) : {} });
  if (!originOk) return reply({ error: 'forbidden' }, 403);
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, origin);
  if (Number(req.headers.get('content-length') ?? 0) > 8192) return reply({ error: 'payload_too_large' }, 413, origin);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return reply({ error: 'invalid_json' }, 400, origin); }

  if (b.website) return reply({ ok: true }, 200, origin); // honeypot: los bots llenan este campo oculto

  const name = str(b.name, 2, 120);
  const phone = str(b.phone, 8, 20);
  const address = str(b.address, 10, 400);
  const email = b.email ? str(b.email, 5, 160) : '';
  const version = str(b.privacyVersion, 1, 20);
  if (!name || !phone || !/^\+?[0-9 ()-]{8,20}$/.test(phone) || !address || email === null || !version ||
      (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) || b.privacyAccepted !== true) {
    return reply({ error: 'invalid_input' }, 400, origin);
  }

  // Ítems: validar forma y sumar duplicados (misma variante => una sola línea)
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 20) return reply({ error: 'invalid_items' }, 400, origin);
  const merged = new Map<string, { product_id: string; color: string; size: number; qty: number }>();
  for (const raw of b.items as Record<string, unknown>[]) {
    const product_id = str(raw?.productId, 2, 60);
    const color = str(raw?.color, 1, 60);
    const size = Number(raw?.size), qty = Number(raw?.qty);
    if (!product_id || !/^[a-z0-9-]+$/.test(product_id) || !color || !Number.isInteger(size) || size < 30 || size > 50 ||
        !Number.isInteger(qty) || qty < 1 || qty > 10) return reply({ error: 'invalid_items' }, 400, origin);
    const k = `${product_id}|${color}|${size}`;
    const prev = merged.get(k);
    merged.set(k, { product_id, color, size, qty: Math.min(10, (prev?.qty ?? 0) + qty) });
  }

  if (TURNSTILE_SECRET) {
    const token = str(b.turnstileToken, 10, 2048);
    if (!token) return reply({ error: 'captcha_required' }, 400, origin);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: req.headers.get('cf-connecting-ip') ?? '' }),
    });
    if (!(await r.json()).success) return reply({ error: 'captcha_failed' }, 403, origin);
  }

  const { data, error } = await db.rpc('place_order', {
    p_name: name, p_phone: phone, p_email: email, p_address: address,
    p_privacy_version: version, p_items: [...merged.values()],
  });
  if (error) {
    const known: Record<string, number> = { out_of_stock: 409, variant_not_found: 404, invalid_items: 400, invalid_qty: 400 };
    const key = Object.keys(known).find((k) => error.message?.includes(k));
    if (key) return reply({ error: key }, known[key], origin);
    console.error('place_order failed', error.message);
    return reply({ error: 'server_error' }, 500, origin);
  }
  return reply({ ok: true, ...data }, 201, origin);
});
