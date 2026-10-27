-- Datos de ejemplo tomados de tu catálogo actual. AJUSTA stock y precios antes de producción.
insert into public.products (id, brand, model, price_cents) values
  ('ball-star',  'Golden Goose',    'Ball Star',  59000),
  ('super-star', 'Golden Goose',    'Super-Star', 62000),
  ('stardan',    'Golden Goose',    'Stardan',    64000),
  ('replica',    'Maison Margiela', 'Replica',    78000)
on conflict (id) do nothing;

insert into public.product_variants (product_id, color, size, stock)
select p.id, c.color, s.size, 1
from (values
  ('ball-star',  'Blanco con estrella negra'), ('ball-star',  'Blanco con estrella azul'), ('ball-star', 'Negro con estrella blanca'),
  ('super-star', 'Estrella roja'),             ('super-star', 'Negro'),
  ('stardan',    'Blanco con estrella negra'),
  ('replica',    'Blanco'), ('replica', 'Negro total'), ('replica', 'Pintura multicolor'), ('replica', 'Azul marino'),
  ('replica',    'Granate'), ('replica', 'Café'), ('replica', 'Gris')
) as c(pid, color)
join public.products p on p.id = c.pid
cross join generate_series(38, 44) as s(size)
on conflict (product_id, color, size) do nothing;

insert into public.promotions (name, percent, starts_at, ends_at) values
  ('Día de Muertos × Halloween', 15, '2026-10-01 00:00:00-06', '2026-11-02 23:59:59-06');
