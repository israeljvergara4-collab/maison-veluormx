# Maison Velour

Sitio estático (HTML/CSS/JS) + base de datos Supabase con RLS + API de pedidos. Hosting: Cloudflare Pages.

```
src/            código fuente (index.html, css/, js/, img/, legal/)
public/         archivos que se copian tal cual (_headers = seguridad y caché)
scripts/        build.mjs (minifica, pone hash, genera legales, verifica)
supabase/       migrations/ (esquema + RLS), functions/create-order (API), seed.sql
site.config.json   datos del negocio que alimentan las páginas legales
.github/        CI/CD (build → Cloudflare Pages + migraciones Supabase)
```

## Resultado del build
| | Antes | Ahora |
|---|---|---|
| HTML | 312 KB (13 imágenes en base64 dentro) | 31 KB (6 KB con brotli) |
| CSS | dentro del HTML | 27.7 KB (6.3 KB brotli), archivo aparte con hash |
| JS | dentro del HTML | 12.1 KB (3.8 KB brotli), archivo aparte con hash |
| Imágenes | base64 (no cacheables, +33 %) | 13 `.webp` con hash, 179 KB, carga diferida |
| Source maps | — | **ninguno** (el build falla si aparece un `.map` o `sourceMappingURL`) |

El hosting comprime con brotli/gzip automáticamente; el build solo minifica.

## Comandos
```bash
npm install          # una vez; sube package-lock.json a git (el CI usa npm ci)
npm run build        # genera dist/ (avisa de datos pendientes)
npm run build:strict # igual, pero FALLA si falta algún dato legal (lo usa producción)
npm run preview      # sirve dist/ en http://localhost:4173
```

## Antes de publicar (obligatorio)
1. Completa **todos** los `[PENDIENTE…]` de `site.config.json` (razón social, RFC, domicilio, correos, paquetería, tiempos…) y `siteUrl`.
2. Completa en `src/legal/envios-y-devoluciones.html` la política de cambios de talla y el plazo de reembolso.
3. El pie de página del sitio dice *«Precios y descuento de ejemplo»*: quítalo cuando los precios sean reales.
4. **Pide a un abogado que revise los textos legales.** Son una base redactada según la LFPDPPP vigente (autoridad: Secretaría Anticorrupción y Buen Gobierno) y el art. 56 de la LFPC (revocación en 5 días hábiles), pero no son asesoría legal. Revisa en especial: aclaración de marcas de terceros, garantía y jurisdicción.

## Hosting y deploy
1. Sube el repo a GitHub (rama `main`).
2. Cloudflare → Workers & Pages → crea el proyecto **maison-velour** (modo "Direct upload"; el deploy lo hace GitHub Actions). Conecta tu dominio y activa SSL/TLS «Full (strict)».
3. GitHub → Settings → Secrets and variables → Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN` (permiso *Pages: Edit*), `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
   - Variable: `SITE_URL` = `https://www.tudominio.mx`.
   - Environment `production` con aprobación manual (opcional pero recomendado).
4. Cada push a `main`: build estricto → deploy del sitio → migraciones nuevas y Edge Function. Cada Pull Request: solo build y verificación.
`dist/` + `_headers` también funciona en Netlify (cambia solo el paso de deploy).

## Caché
| Archivo | Cache-Control | Por qué |
|---|---|---|
| `/assets/*`, `/img/*` | `public, max-age=31536000, immutable` | El nombre lleva hash del contenido: si cambia el archivo, cambia la URL |
| HTML | revalida en cada visita (ETag) | Un deploy se ve al instante y apunta a los nuevos hashes |
| `robots.txt`, `sitemap.xml` | 1 hora | |

## Seguridad
- **`public/_headers`**: HSTS, CSP estricta (solo scripts propios; sin `unsafe-inline` en scripts), `nosniff`, anti-iframe (`frame-ancestors 'none'`), Referrer-Policy, Permissions-Policy, COOP.
- Si agregas Google Analytics, Meta Pixel, un chat, etc., hay que ampliar la CSP **y** actualizar la política de cookies, y pedir consentimiento antes de activarlos (hoy no hay nada opcional, por eso no hay banner).
- Recomendado: autoalojar las tipografías (hoy se piden a Google Fonts, que recibe la IP del visitante; está declarado en el aviso). Al hacerlo, quita los dominios de Google de la CSP y del aviso.
- Cloudflare → Security → WAF: regla de *rate limiting* sobre `/functions/v1/create-order` (p. ej. 5 peticiones/min por IP) y activa Turnstile (`TURNSTILE_SECRET`).
- GitHub: protege `main` (PR obligatorio, CI en verde), activa 2FA, *secret scanning* y Dependabot (ya configurado).
- `/.well-known/security.txt` se genera con tu correo de seguridad.

## Base de datos (Supabase)
1. Crea el proyecto, **Auth → desactiva sign-ups** (`config.toml` ya lo indica; en el proyecto remoto se cambia en el panel).
2. `supabase link --project-ref <ref>` y `supabase db push` (o deja que lo haga el CI). Opcional: `supabase db query < supabase/seed.sql` para cargar tu catálogo de ejemplo.
3. Variables de la función: `supabase secrets set ALLOWED_ORIGINS=https://www.tudominio.mx TURNSTILE_SECRET=...`
4. Para tener un admin: en SQL Editor,  
   `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'tu@correo';`  
   (`app_metadata` no lo puede modificar el usuario, a diferencia de `user_metadata`.)

**Qué garantiza el RLS:** todas las tablas tienen RLS activado. El navegador (rol `anon`) solo puede leer productos/variantes/promociones activas y **no ve la columna `stock`**; no puede leer ni escribir pedidos. Los pedidos solo entran por `place_order()`, ejecutable únicamente por `service_role`, que calcula precios y descuento desde la base de datos.

**Prueba rápida de RLS** (SQL Editor): `set role anon; select * from orders;` → debe dar *permission denied*; `select stock from product_variants;` → también.

## API: `POST /functions/v1/create-order`
```json
{ "name":"Ana Pérez", "phone":"229 123 4567", "email":"", "address":"Calle, Col., CP, Ciudad",
  "privacyAccepted": true, "privacyVersion":"2026-10-25", "turnstileToken":"...",
  "items":[{ "productId":"ball-star", "color":"Blanco con estrella negra", "size":40, "qty":1 }] }
```
Respuesta `201`: `{ ok, code, subtotal_cents, discount_cents, total_cents }`. Errores: `400 invalid_input`, `409 out_of_stock`, `404 variant_not_found`, `403` (origen o captcha).
**Hoy el sitio sigue enviando pedidos por WhatsApp** y no llama a esta API; conectarla es un cambio aparte en `src/js/01-app.js` (formulario de nombre/teléfono/dirección + casilla del aviso de privacidad + Turnstile).

## Git y versiones
- `main` siempre desplegable; trabajo en ramas `feat/…`, `fix/…`, `legal/…` y Pull Request.
- Commits convencionales: `feat:`, `fix:`, `docs:`, `chore:`, `legal:`.
- Versiones con tags (`v1.0.1`) y `CHANGELOG.md`. Para **revertir un deploy**: Cloudflare → Deployments → *Rollback*, y `git revert` del commit.
- Migraciones: archivos nuevos en `supabase/migrations/` con fecha; nunca edites una ya aplicada. Se avanza siempre hacia adelante.

## Qué NO se pudo probar aquí
El sitio, el build y la CSP sí se probaron en un navegador (carrito, hero, páginas legales, sin errores). El SQL de Supabase y la Edge Function **no se ejecutaron contra un proyecto real** (sin red en el entorno de trabajo; solo se validó la sintaxis TypeScript). Pruébalos primero en un proyecto de staging con la prueba de RLS de arriba.
