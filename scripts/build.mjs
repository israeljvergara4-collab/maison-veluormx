// Build de producción de Maison Velour.
// - Minifica HTML, CSS y JS (sin source maps, sin comentarios).
// - Nombra los archivos con hash de contenido => caché de 1 año con "immutable".
// - Genera páginas legales, 404, robots.txt, sitemap.xml y security.txt.
// - Verifica el resultado (falla si queda un .map o un enlace roto).
//
// Uso:  node scripts/build.mjs            (desarrollo: avisa de datos pendientes)
//       node scripts/build.mjs --strict   (producción: FALLA si quedan datos [PENDIENTE])
import { transform } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = (...p) => path.join(ROOT, 'src', ...p);
const DIST = (...p) => path.join(ROOT, 'dist', ...p);
const STRICT = process.argv.includes('--strict');

const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE_URL = (process.env.SITE_URL || cfg.siteUrl).replace(/\/+$/, '');
const vars = { ...cfg, SITE_URL };

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
const write = async (rel, data) => {
  await fs.mkdir(path.dirname(DIST(rel)), { recursive: true });
  await fs.writeFile(DIST(rel), data);
};

function minHtml(h) {
  if (/<(pre|textarea)\b/i.test(h)) throw new Error('minHtml: <pre>/<textarea> no soportado');
  return h
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/ ?(<\/?(?:html|head|body|meta|link|title|script|style|section|header|footer|main|nav|div|ul|ol|li|h[1-6]|p|dl|dt|dd|aside)\b[^>]*>) ?/gi, '$1')
    .trim();
}

await fs.rm(DIST(), { recursive: true, force: true });
await fs.mkdir(DIST(), { recursive: true });

// ---------- 1) Imágenes con hash ----------
const imgMap = {};
for (const f of (await fs.readdir(SRC('img'))).filter((f) => f.endsWith('.webp'))) {
  const buf = await fs.readFile(SRC('img', f));
  const name = f.replace(/\.webp$/, '');
  imgMap[`/img/${f}`] = `/img/${name}.${hash(buf)}.webp`;
  await write(`img/${name}.${hash(buf)}.webp`, buf);
}
const rewriteImgs = (h) => h.replace(/\/img\/[a-z0-9-]+\.webp/g, (m) => imgMap[m] ?? m);

// ---------- 2) CSS y JS ----------
async function css(file, out) {
  const { code } = await transform(await fs.readFile(SRC('css', file), 'utf8'), {
    loader: 'css', minify: true, legalComments: 'none',
  });
  const name = `assets/${out}.${hash(code)}.css`;
  await write(name, code);
  return '/' + name;
}
const mainCss = await css('main.css', 'main');
const legalCss = await css('legal.css', 'legal');

const jsFiles = (await fs.readdir(SRC('js'))).filter((f) => f.endsWith('.js')).sort();
const jsSrc = (await Promise.all(jsFiles.map((f) => fs.readFile(SRC('js', f), 'utf8')))).join('\n;\n');
const { code: jsCode } = await transform(jsSrc, {
  loader: 'js', minify: true, target: 'es2019', legalComments: 'none', drop: ['debugger', 'console'],
  // sourcemap: omitido a propósito => no se genera ni se enlaza ningún .map
});
const mainJs = `/assets/app.${hash(jsCode)}.js`;
await write(mainJs.slice(1), jsCode);

// ---------- 3) Página principal ----------
let index = await fs.readFile(SRC('index.html'), 'utf8');
index = index
  .replace('<!--CSS-->', `<link rel="stylesheet" href="${mainCss}">`)
  .replace('<!--JS-->', `<script src="${mainJs}" defer></script>`);
index = minHtml(rewriteImgs(fill(index)));
await write('index.html', index);

// ---------- 4) Páginas legales + 404 ----------
const layout = await fs.readFile(SRC('legal', '_layout.html'), 'utf8');
const pages = [
  { slug: 'aviso-de-privacidad', title: 'Aviso de privacidad', desc: 'Cómo tratamos tus datos personales en Maison Velour (LFPDPPP).' },
  { slug: 'politica-de-cookies', title: 'Política de cookies y almacenamiento local', desc: 'Qué guarda este sitio en tu navegador y por qué.' },
  { slug: 'terminos-y-condiciones', title: 'Términos y condiciones', desc: 'Condiciones de uso del sitio y de compra en Maison Velour.' },
  { slug: 'envios-y-devoluciones', title: 'Envíos y devoluciones', desc: 'Tiempos de envío, cambios, devoluciones y derecho de revocación.' },
];
const render = (p, content, extra = '') =>
  minHtml(fill(layout
    .replaceAll('{{TITLE}}', p.title).replaceAll('{{DESC}}', p.desc)
    .replaceAll('{{CANONICAL}}', `${SITE_URL}/${p.slug ? p.slug + '/' : ''}`)
    .replaceAll('{{CSS}}', legalCss).replace('{{ROBOTS}}', extra)
    .replace('{{CONTENT}}', () => content)));
for (const p of pages) {
  const body = await fs.readFile(SRC('legal', `${p.slug}.html`), 'utf8');
  await write(`${p.slug}/index.html`, render(p, body));
}
await write('404.html', render(
  { slug: '', title: 'Página no encontrada', desc: 'La página que buscas no existe.' },
  '<h1>Página no encontrada</h1><p>El enlace no existe o cambió. <a href="/">Volver al inicio</a>.</p>',
  '<meta name="robots" content="noindex">'));

// ---------- 5) robots, sitemap, security.txt ----------
const today = new Date().toISOString().slice(0, 10);
await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await write('sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  ['', ...pages.map((p) => p.slug + '/')].map((u) => `<url><loc>${SITE_URL}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`);
const exp = new Date(Date.now() + 365 * 864e5).toISOString();
await write('.well-known/security.txt',
  `Contact: mailto:${cfg.emailSeguridad}\nExpires: ${exp}\nPreferred-Languages: es, en\nCanonical: ${SITE_URL}/.well-known/security.txt\n`);

// ---------- 6) Archivos estáticos (_headers, etc.) ----------
async function copyDir(from, to) {
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const s = path.join(from, e.name), d = path.join(to, e.name);
    if (e.isDirectory()) { await fs.mkdir(d, { recursive: true }); await copyDir(s, d); }
    else { await fs.mkdir(path.dirname(d), { recursive: true }); await fs.copyFile(s, d); }
  }
}
await copyDir(path.join(ROOT, 'public'), DIST());

// ---------- 7) Verificación ----------
const walk = async (d) => (await Promise.all((await fs.readdir(d, { withFileTypes: true }))
  .map((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])))).flat();
const files = await walk(DIST());
const errors = [];
for (const f of files) {
  const rel = path.relative(DIST(), f).split(path.sep).join('/');
  if (rel.endsWith('.map')) errors.push(`source map presente: ${rel}`);
  if (/\.(js|css|html)$/.test(rel)) {
    const t = await fs.readFile(f, 'utf8');
    if (/sourceMappingURL/.test(t)) errors.push(`referencia a source map en ${rel}`);
    if (rel.endsWith('.html')) {
      if (/base64,[A-Za-z0-9+/=]{2000,}/.test(t)) errors.push(`base64 grande embebido en ${rel}`);
      for (const m of t.matchAll(/(?:href|src)="(\/(?:assets|img)\/[^"]+)"/g))
        if (!files.includes(DIST(m[1].slice(1)))) errors.push(`enlace roto en ${rel}: ${m[1]}`);
      for (const m of t.matchAll(/href="(\/[a-z-]+\/)"/g))
        if (!files.includes(DIST(m[1].slice(1), 'index.html'))) errors.push(`enlace roto en ${rel}: ${m[1]}`);
    }
  }
}
if (!files.includes(DIST('_headers'))) errors.push('falta _headers');

const pending = new Set();
for (const f of files.filter((f) => /\.(html|txt)$/.test(f))) {
  for (const m of (await fs.readFile(f, 'utf8')).matchAll(/\[PENDIENTE[^\]]*\]/g)) pending.add(m[0]);
}
if (/TU-DOMINIO/.test(SITE_URL)) pending.add('[PENDIENTE: siteUrl en site.config.json o variable SITE_URL]');

// ---------- Informe ----------
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
console.log('\nArchivo                                       Original     gzip   brotli');
let total = 0;
for (const f of files.filter((f) => /\.(html|css|js)$/.test(f) && !f.includes('/404'))) {
  const b = await fs.readFile(f); total += b.length;
  console.log(path.relative(DIST(), f).padEnd(42), kb(b.length), kb(zlib.gzipSync(b, { level: 9 }).length), kb(zlib.brotliCompressSync(b).length));
}
const imgBytes = (await Promise.all(files.filter((f) => f.includes(`${path.sep}img${path.sep}`)).map((f) => fs.stat(f)))).reduce((a, s) => a + s.size, 0);
console.log(`\nHTML+CSS+JS: ${kb(total).trim()} · Imágenes: ${kb(imgBytes).trim()} · Archivos: ${files.length}`);

if (pending.size) {
  console.log(`\n${STRICT ? 'ERROR' : 'Aviso'}: faltan ${pending.size} datos por completar en site.config.json:`);
  [...pending].forEach((p) => console.log('  - ' + p));
}
if (errors.length) { console.error('\nERRORES:\n  - ' + errors.join('\n  - ')); process.exit(1); }
if (STRICT && pending.size) process.exit(1);
console.log('\nBuild OK ✔  (sin source maps)');
