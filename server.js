import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initGeoIP,
  extractClientIps,
  pickGeoIp,
  isPrivateIp,
  isValidIp,
} from './lib/geoip.js';
import { enrichLookup } from './lib/enrich.js';
import { initGeolite } from './lib/geolite-merge.js';
import { SITE, PAGES, PAGE_BY_PATH, HTML_REDIRECTS } from './lib/site-config.js';
import { rateLimitMiddleware } from './lib/rate-limit.js';
import { loadView, hasView } from './lib/views.js';
import {
  renderAppPage,
  renderAppHero,
  renderDocument,
  renderFooter,
  breadcrumbSchema,
  escapeHtml,
  absUrl,
} from './lib/render.js';
import { renderHome, renderRegisteredPage, renderBlogPost, render404 } from './lib/pages.js';
import { renderAsnPage, renderCountryPage, asnIndexAvailable } from './lib/programmatic.js';
import {
  urlset,
  sitemapIndex,
  indexChildren,
  pageEntries,
  blogEntries,
  asnEntries,
  countryEntries,
  robotsTxt,
} from './lib/sitemap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3920;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.use(express.json({ limit: '64kb' }));

// Cloudflare Web Analytics loads its beacon from static.cloudflareinsights.com and
// reports to cloudflareinsights.com. Both hosts are allowed ONLY when a token is
// configured, so the default policy stays as tight as it was.
const CF_ANALYTICS = Boolean(SITE.cfBeaconToken);
const CF_SCRIPT_HOST = 'https://static.cloudflareinsights.com';
const CF_REPORT_HOST = 'https://cloudflareinsights.com';

const CSP = [
  "default-src 'self'",
  `script-src 'self'${CF_ANALYTICS ? ` ${CF_SCRIPT_HOST}` : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self'${CF_ANALYTICS ? ` ${CF_REPORT_HOST}` : ''}`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.headers['cf-connecting-ip'] || req.ip,
      ms: Date.now() - start,
    };
    if (res.statusCode >= 400 || req.path.startsWith('/api/')) {
      console.log(JSON.stringify(entry));
    }
  });
  next();
});

const dbReady = await initGeoIP();
await initGeolite();

// ───────────────────────────── canonicalisation ─────────────────────────────
// One URL per page. These run before express.static so a legacy `.html` request
// can never be served a 200 body.

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  const [pathname] = req.originalUrl.split('?');
  const query = req.originalUrl.slice(pathname.length);

  const legacy = HTML_REDIRECTS.get(pathname);
  if (legacy) return res.redirect(301, legacy + query);

  // Strip a trailing slash (except the root) — /about/ and /about are one page.
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return res.redirect(301, pathname.slice(0, -1) + query);
  }

  // Fold mixed-case page paths down to lowercase. Deliberately excludes /lookup,
  // /asn and /country, whose params are case-normalised by their own handlers,
  // and excludes /api plus any path with a file extension (assets stay verbatim).
  if (/[A-Z]/.test(pathname) && !/^\/(api|lookup|asn|country)\b/i.test(pathname) && !/\.[a-z0-9]+$/i.test(pathname)) {
    const lower = pathname.toLowerCase();
    if (PAGE_BY_PATH.has(lower) || HTML_REDIRECTS.has(lower)) {
      return res.redirect(301, lower + query);
    }
  }

  return next();
});

/**
 * Defence in depth for the duplicate-content problem. Every page is rendered from
 * views/ now, so nothing under public/ should ever be served as HTML, and source
 * maps are a build artefact. Enforcing it here means a stale file left on disk —
 * or a path missing from HTML_REDIRECTS — still cannot produce a second
 * indexable copy of a page.
 */
app.use((req, res, next) => {
  if (/\.(html?|map)$/i.test(req.path)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  return next();
});

// ───────────────────────────────── the API ──────────────────────────────────

function proxyChain(req) {
  const xff = req.headers['x-forwarded-for'];
  if (!xff) return null;
  return xff.split(',').map((s) => s.trim()).filter(Boolean);
}

const apiLimiter = rateLimitMiddleware({ max: 60, windowMs: 60_000 });
const bulkLimiter = rateLimitMiddleware({ max: 30, windowMs: 60_000 });

const BULK_MAX = 100;

app.get('/api/health', apiLimiter, (_req, res) => {
  res.json({ ok: true, database: dbReady, version: '1.0.0' });
});

app.get('/api/me', apiLimiter, async (req, res) => {
  const ips = extractClientIps(req);
  const ip = pickGeoIp(ips);
  const chain = proxyChain(req);
  const geo = await enrichLookup(ip, { proxyChain: chain });
  res.json({
    ...geo,
    ipv4: ips.ipv4,
    ipv6: ips.ipv6,
    connectionIp: ips.connectionIp,
    isLocalConnection: isPrivateIp(ips.connectionIp ?? ''),
    needsClientDiscovery: isPrivateIp(ip),
    proxyChain: chain,
    connectionSecure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    detected: true,
  });
});

app.get('/api/lookup/:ip', apiLimiter, async (req, res) => {
  const ip = decodeURIComponent(req.params.ip).trim();
  if (!isValidIp(ip)) {
    return res.status(400).json({ error: 'Invalid IP address' });
  }
  const geo = await enrichLookup(ip);
  res.json({ ...geo, detected: false });
});

app.post('/api/bulk', bulkLimiter, async (req, res) => {
  const ips = Array.isArray(req.body?.ips) ? req.body.ips.map((s) => String(s).trim()).filter(Boolean) : [];
  if (!ips.length) return res.status(400).json({ error: 'Provide an "ips" array' });
  if (ips.length > BULK_MAX) return res.status(400).json({ error: `Too many IPs (max ${BULK_MAX})` });

  const results = await Promise.all(ips.map(async (ip) => {
    if (!isValidIp(ip)) return { ip, error: 'Invalid IP address' };
    try {
      const geo = await enrichLookup(ip);
      return { ip, ...geo };
    } catch {
      return { ip, error: 'Lookup failed' };
    }
  }));

  res.json({ count: results.length, results, max: BULK_MAX });
});

// ──────────────────────────── robots and sitemaps ───────────────────────────

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(robotsTxt());
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(sitemapIndex(indexChildren()));
});

app.get('/sitemap-pages.xml', (_req, res) => {
  res.type('application/xml').send(urlset(pageEntries()));
});

app.get('/sitemap-blog.xml', (_req, res) => {
  res.type('application/xml').send(urlset(blogEntries()));
});

app.get('/sitemap-asn.xml', (_req, res) => {
  const entries = asnEntries();
  if (!entries.length) return res.status(404).type('text/plain').send('No ASN index built');
  res.type('application/xml').send(urlset(entries));
});

app.get('/sitemap-country.xml', (_req, res) => {
  const entries = countryEntries();
  if (!entries.length) return res.status(404).type('text/plain').send('No country index built');
  res.type('application/xml').send(urlset(entries));
});

// ─────────────────────────── statically routed pages ────────────────────────

app.get('/', (_req, res) => {
  res.type('html').send(renderHome());
});

// Every non-home page comes from the single PAGES registry. A registered page with
// no view is a wiring bug worth surfacing at boot rather than as a silent 404.
const missingViews = PAGES.filter((p) => !hasView(p.view));
if (missingViews.length) {
  console.warn(`Views missing for: ${missingViews.map((p) => `${p.path} (views/${p.view}.html)`).join(', ')}`);
}

for (const page of PAGES) {
  if (page.path === '/' || !hasView(page.view)) continue;
  app.get(page.path, (_req, res) => {
    res.type('html').send(renderRegisteredPage(page));
  });
}

// ───────────────────────────────── the blog ─────────────────────────────────

app.get('/blog/:slug', (req, res, next) => {
  const html = renderBlogPost(String(req.params.slug).toLowerCase());
  if (!html) return next();
  res.type('html').send(html);
});

// ──────────────────── programmatic ASN and country pages ────────────────────

app.get('/asn/:asn', async (req, res, next) => {
  const raw = String(req.params.asn).trim().toUpperCase();
  const match = /^AS(\d{1,10})$/.exec(raw);
  if (!match) {
    // Accept a bare number but canonicalise to the ASxxx form.
    const bare = /^(\d{1,10})$/.exec(raw);
    if (bare) return res.redirect(301, `/asn/AS${bare[1]}`);
    return next();
  }
  if (raw !== req.params.asn) return res.redirect(301, `/asn/${raw}`);

  const html = await renderAsnPage(match[1]);
  if (!html) return next();
  res.type('html').send(html);
});

app.get('/country/:cc', async (req, res, next) => {
  const raw = String(req.params.cc).trim();
  if (!/^[A-Za-z]{2}$/.test(raw)) return next();
  if (raw !== raw.toLowerCase()) return res.redirect(301, `/country/${raw.toLowerCase()}`);

  const html = await renderCountryPage(raw.toUpperCase());
  if (!html) return next();
  res.type('html').send(html);
});

// ─────────────────────────── per-IP lookup pages ────────────────────────────

/**
 * Curated IPs are indexable; anything else is rendered but marked noindex so the
 * long tail of arbitrary addresses cannot bloat the index.
 */
const INDEXABLE_IPS = new Set([
  '8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '149.112.112.112',
  '208.67.222.222', '208.67.220.220', '4.2.2.1', '4.2.2.2', '64.6.64.6',
  '76.76.2.0', '94.140.14.14', '185.228.168.9', '76.76.19.19',
  '2001:4860:4860::8888', '2001:4860:4860::8844', '2606:4700:4700::1111',
  '2620:fe::fe', '2a0d:2a00:1::',
]);

app.get('/lookup/:ip', async (req, res, next) => {
  let ip;
  try {
    ip = decodeURIComponent(String(req.params.ip)).trim();
  } catch {
    return next();
  }
  if (!isValidIp(ip)) return next();

  const geo = await enrichLookup(ip);
  const page = PAGE_BY_PATH.get('/');
  const canonical = `/lookup/${ip}`;
  const indexable = INDEXABLE_IPS.has(ip.toLowerCase()) && !geo.private;

  const where = [geo.city, geo.state, geo.country].filter(Boolean).join(', ');
  const org = geo.isp || geo.rdapName || null;

  const title = geo.private
    ? `${ip} — Private IP Address | ${SITE.name}`
    : `${ip} — IP Address Location${where ? `, ${where}` : ''}${org ? ` (${org})` : ''} | ${SITE.name}`;

  const description = geo.private
    ? `${ip} is a private, non-routable address reserved for use inside local networks, so it has no public geolocation.`
    : [
        `IP address ${ip}`,
        where ? `resolves to ${where}` : 'has no city-level record',
        org ? `on ${org}` : '',
        geo.asn ? `(AS${String(geo.asn).replace(/^AS/i, '')})` : '',
        '— with timezone, ASN, reverse DNS, and registry details.',
      ]
        .filter(Boolean)
        .join(' ');

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: absUrl(canonical),
      isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
      breadcrumb: breadcrumbSchema([{ name: `IP ${ip}`, path: canonical }]),
    },
  ];

  if (!geo.private && geo.latitude != null && geo.longitude != null) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: where || `Approximate location of ${ip}`,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
      address: {
        '@type': 'PostalAddress',
        addressLocality: geo.city || undefined,
        addressRegion: geo.state || undefined,
        addressCountry: geo.countryCode || undefined,
        postalCode: geo.postal || undefined,
      },
    });
  }

  const h1 = geo.private
    ? `${escapeHtml(ip)}<br>Private address`
    : `${escapeHtml(ip)}${where ? `<br>${escapeHtml(where)}` : ''}`;

  const tagline = geo.private
    ? 'This address is reserved for private networks and cannot be geolocated.'
    : `Location, ISP, ASN, timezone and registry details for ${ip}. Geolocation is approximate — city level at best.`;

  res.type('html').send(
    renderAppPage(page, {
      title,
      description,
      canonical,
      robots: indexable ? undefined : 'noindex, follow',
      heroHtml: renderAppHero({
        h1Html: h1,
        tagline,
        breadcrumbs: [{ name: `IP ${ip}`, path: canonical }],
      }),
      bodyHtml: loadView('home').html,
      jsonLd,
      scripts: ['/js/app.js'],
    }),
  );
});

// ─────────────────────────── static assets and 404 ──────────────────────────

// Vendored and hashed assets never change under the same URL; app CSS/JS may, so
// they get a shorter TTL and revalidate.
app.use(
  '/vendor',
  express.static(join(__dirname, 'public', 'vendor'), {
    dotfiles: 'deny',
    index: false,
    immutable: true,
    maxAge: '365d',
    // The source map is a development artefact; do not serve it in production.
    setHeaders(res, path) {
      if (path.endsWith('.map')) res.setHeader('Cache-Control', 'no-store');
    },
  }),
);

app.use(
  express.static(join(__dirname, 'public'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '7d',
    setHeaders(res, path) {
      if (/\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/i.test(path)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
      }
    },
  }),
);

app.use((req, res) => {
  res.status(404).type('html').send(render404(req.path));
});

app.listen(PORT, HOST, () => {
  console.log(`IPScope running at http://${HOST}:${PORT}`);
  if (!dbReady) console.log('Run npm run download-db to enable geolocation.');
  if (!asnIndexAvailable()) console.log('ASN/country pages disabled — run npm run build-index to enable.');
});
