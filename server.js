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
import { SITE, LEGAL_PAGES } from './lib/site-config.js';
import { rateLimitMiddleware } from './lib/rate-limit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3920;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
app.use(express.json({ limit: '16kb' }));

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
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

function proxyChain(req) {
  const xff = req.headers['x-forwarded-for'];
  if (!xff) return null;
  return xff.split(',').map((s) => s.trim()).filter(Boolean);
}

const apiLimiter = rateLimitMiddleware({ max: 60, windowMs: 60_000 });
const bulkLimiter = rateLimitMiddleware({ max: 30, windowMs: 60_000 });

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
  if (ips.length > 20) return res.status(400).json({ error: 'Too many IPs (max 20)' });

  const results = await Promise.all(ips.map(async (ip) => {
    if (!isValidIp(ip)) return { ip, error: 'Invalid IP address' };
    try {
      const geo = await enrichLookup(ip);
      return { ip, ...geo };
    } catch {
      return { ip, error: 'Lookup failed' };
    }
  }));

  res.json({ count: results.length, results });
});

app.get('/sitemap.xml', (_req, res) => {
  const pages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    ...LEGAL_PAGES.map((p) => ({ loc: p.path, priority: '0.6', changefreq: 'monthly' })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE.url}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

for (const page of LEGAL_PAGES) {
  app.get(page.path, (_req, res) => {
    res.sendFile(join(__dirname, 'public', page.file));
  });
}

app.get('/lookup/:ip', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.use(express.static(join(__dirname, 'public'), {
  dotfiles: 'deny',
  index: false,
}));

app.get('/', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`IPScope running at http://${HOST}:${PORT}`);
  if (!dbReady) console.log('Run npm run download-db to enable geolocation.');
});