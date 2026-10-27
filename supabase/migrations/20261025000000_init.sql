-- Maison Velour · esquema inicial con Row Level Security (RLS)
-- Principios:
--   1) RLS activado en TODAS las tablas; sin policy = sin acceso.
--   2) El navegador (rol anon) solo LEE el catálogo público. Nunca escribe y nunca ve pedidos ni stock.
--   3) Los pedidos se crean SOLO desde la Edge Function (service_role) llamando a place_order(),
--      que calcula los precios en el servidor. El cliente nunca manda precios.
--   4) "Admin" = usuario con app_metadata.role = 'admin' (app_metadata NO lo puede editar el usuario).

create type public.order_status as enum
  ('pending', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');

-- ---------- helpers ----------
create function public.is_admin() returns boolean
language sql stable set search_path = ''
as $$ select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin' $$;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- tablas ----------
create table public.products (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  brand       text not null,
  model       text not null,
  price_cents integer not null check (price_cents > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  color      text not null check (char_length(color) between 1 and 60),
  size       smallint not null check (size between 30 and 50),
  stock      integer not null default 0 check (stock >= 0),
  active     boolean not null default true,
  unique (product_id, color, size)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.promotions (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  percent   smallint not null check (percent between 1 and 90),
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  active    boolean not null default true,
  check (ends_at > starts_at)
);

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  public_code            text not null unique
                           default ('MV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  status                 public.order_status not null default 'pending',
  customer_name          text not null check (char_length(customer_name) between 2 and 120),
  customer_phone         text not null check (customer_phone ~ '^\+?[0-9 ()-]{8,20}$'),
  customer_email         text check (customer_email is null or customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  shipping_address       text not null check (char_length(shipping_address) between 10 and 400),
  promotion_id           uuid references public.promotions(id),
  subtotal_cents         integer not null default 0 check (subtotal_cents >= 0),
  discount_cents         integer not null default 0 check (discount_cents >= 0),
  total_cents            integer not null default 0 check (total_cents >= 0),
  privacy_notice_version text not null,            -- evidencia de qué aviso de privacidad se aceptó
  privacy_accepted_at    timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index orders_status_created_idx on public.orders (status, created_at desc);

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  variant_id       uuid not null references public.product_variants(id),
  description      text not null,                  -- foto fija: "Golden Goose Ball Star · Blanco · 40"
  qty              smallint not null check (qty between 1 and 10),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  unique (order_id, variant_id)
);

create trigger products_updated  before update on public.products  for each row execute function public.set_updated_at();
create trigger orders_updated    before update on public.orders    for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.promotions       enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;

-- Privilegios mínimos (RLS decide FILAS; los GRANT deciden tablas/columnas).
revoke all on public.products, public.product_variants, public.promotions,
              public.orders, public.order_items from anon, authenticated;

grant select on public.products, public.promotions to anon;
grant select (id, product_id, color, size, active) on public.product_variants to anon;  -- sin la columna stock
grant select, insert, update, delete on public.products, public.product_variants, public.promotions to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Público (anon): solo catálogo activo.
create policy products_public_read on public.products
  for select to anon using (active);
create policy variants_public_read on public.product_variants
  for select to anon using (active and exists (
    select 1 from public.products p where p.id = product_id and p.active));
create policy promotions_public_read on public.promotions
  for select to anon using (active and now() between starts_at and ends_at);

-- Admin (authenticated con app_metadata.role = 'admin').
create policy products_admin_all on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy variants_admin_all on public.product_variants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy promotions_admin_all on public.promotions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy orders_admin_read on public.orders
  for select to authenticated using ((select public.is_admin()));
create policy orders_admin_update on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy order_items_admin_read on public.order_items
  for select to authenticated using ((select public.is_admin()));
-- Nota: orders/order_items NO tienen policy de INSERT ni DELETE: solo place_order() (service_role) inserta.

-- ---------- creación de pedidos (precios calculados aquí, no en el navegador) ----------
create function public.place_order(
  p_name text, p_phone text, p_email text, p_address text,
  p_privacy_version text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  it        jsonb;
  v_var     public.product_variants%rowtype;
  v_prod    public.products%rowtype;
  v_promo   public.promotions%rowtype;
  v_promo_id uuid;
  v_pct     int := 0;
  v_qty     int;
  v_unit    int;
  v_sub     int := 0;
  v_total   int := 0;
  v_order   uuid;
  v_code    text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_items';
  end if;

  select * into v_promo from public.promotions
   where active and now() between starts_at and ends_at
   order by percent desc limit 1;
  if found then v_pct := v_promo.percent; v_promo_id := v_promo.id; end if;

  insert into public.orders (customer_name, customer_phone, customer_email, shipping_address,
                             privacy_notice_version, promotion_id)
  values (p_name, p_phone, nullif(p_email, ''), p_address, p_privacy_version, v_promo_id)
  returning id, public_code into v_order, v_code;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::int;
    if v_qty is null or v_qty not between 1 and 10 then raise exception 'invalid_qty'; end if;

    select v.* into v_var from public.product_variants v
     where v.product_id = it ->> 'product_id'
       and v.color = it ->> 'color'
       and v.size = (it ->> 'size')::smallint
       and v.active
     for update;
    if not found then raise exception 'variant_not_found'; end if;
    if v_var.stock < v_qty then raise exception 'out_of_stock'; end if;

    select p.* into v_prod from public.products p where p.id = v_var.product_id and p.active;
    if not found then raise exception 'variant_not_found'; end if;

    v_unit := round(v_prod.price_cents * (100 - v_pct) / 100.0)::int;
    insert into public.order_items (order_id, variant_id, description, qty, unit_price_cents)
    values (v_order, v_var.id,
            v_prod.brand || ' ' || v_prod.model || ' · ' || v_var.color || ' · ' || v_var.size,
            v_qty, v_unit);

    v_sub   := v_sub   + v_prod.price_cents * v_qty;
    v_total := v_total + v_unit * v_qty;
  end loop;

  update public.orders
     set subtotal_cents = v_sub, discount_cents = v_sub - v_total, total_cents = v_total
   where id = v_order;

  return jsonb_build_object('order_id', v_order, 'code', v_code,
                            'subtotal_cents', v_sub, 'discount_cents', v_sub - v_total, 'total_cents', v_total);
end $$;

revoke all on function public.place_order(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to service_role;

-- ---------- stock: se descuenta al CONFIRMAR (no al recibir el pedido, para que el spam no lo agote) ----------
create function public.apply_stock_on_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status = 'pending' then
    update public.product_variants v set stock = v.stock - oi.qty
      from public.order_items oi where oi.order_id = new.id and v.id = oi.variant_id;   -- falla si stock < 0
  elsif new.status = 'cancelled' and old.status in ('confirmed', 'paid') then
    update public.product_variants v set stock = v.stock + oi.qty
      from public.order_items oi where oi.order_id = new.id and v.id = oi.variant_id;
  end if;
  return new;
end $$;
revoke all on function public.apply_stock_on_status() from public, anon, authenticated;
create trigger orders_stock after update of status on public.orders
  for each row execute function public.apply_stock_on_status();
