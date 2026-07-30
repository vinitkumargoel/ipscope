/**
 * IPScope edge Worker.
 *
 * Why this is a hybrid rather than a full migration: the geolocation databases are
 * ~189 MB of MMDB (the three largest files each exceed the 25 MiB per-asset cap),
 * `maxmind` reads them through `fs`, and `geo-tz` ships ~69 MB of geojson. None of
 * that can live in a Worker. So:
 *
 *   - Everything cacheable (pages, blog, ASN/country pages, assets) is served from
 *     Static Assets at the edge, with no origin hit at all.
 *   - Anything needing an arbitrary-IP MMDB lookup (/api/*, /lookup/:ip) is proxied
 *     to the Node origin over the existing Cloudflare tunnel.
 *   - The visitor's *own* geolocation comes from `request.cf`, which Cloudflare
 *     provides free on all plans — so /api/me needs no origin round-trip.
 *
 * Bindings expected (see wrangler.toml):
 *   ASSETS   Static Assets binding
 *   ORIGIN   e.g. "https://origin.ip.vinitk.dev" — the tunnel hostname
 */

const ORIGIN_PATHS = [/^\/api\//, /^\/lookup\//];

/** Paths that must never be cached at the edge. */
const NO_STORE = [/^\/api\//];

function needsOrigin(pathname) {
  return ORIGIN_PATHS.some((re) => re.test(pathname));
}

/** Paths whose casing is meaningful and must not be folded. */
const CASE_SENSITIVE = /^\/(api|lookup|asn|country)\b/i;

/**
 * Mirrors the canonicalisation middleware in server.js so the edge and the origin
 * agree on which URL is canonical. These are pure rules — no page registry — which
 * keeps the Worker independent of lib/site-config.js.
 *
 * Returns the path to redirect to, or null if the request is already canonical.
 * The legacy `.html` URLs are the ones the site served before this rewrite, so
 * they get a 301 rather than the 404 they would otherwise now receive.
 */
function canonicalPath(pathname) {
  let p = pathname;

  // /index.html -> /, /about.html -> /about
  if (/\.html?$/i.test(p)) {
    p = p.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '');
    if (p === '') p = '/';
  }

  // Strip a trailing slash, except on the root.
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

  // Fold page paths to lowercase. Assets keep their casing (they have extensions),
  // and /lookup, /asn, /country normalise their own params.
  if (/[A-Z]/.test(p) && !CASE_SENSITIVE.test(p) && !/\.[a-z0-9]+$/i.test(p)) {
    p = p.toLowerCase();
  }

  return p === pathname ? null : p;
}

/**
 * Builds the /api/me payload from Cloudflare's own request metadata.
 * Deliberately a subset of the origin's response: only fields Cloudflare can
 * actually supply are included, so nothing is invented.
 */
function meFromCf(request) {
  const cf = request.cf;
  if (!cf) return null;

  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return null;

  const isV6 = ip.includes(':');
  const lat = cf.latitude != null ? Number(cf.latitude) : null;
  const lon = cf.longitude != null ? Number(cf.longitude) : null;

  return {
    ip,
    version: isV6 ? 'IPv6' : 'IPv4',
    ipv4: isV6 ? null : ip,
    ipv6: isV6 ? ip : null,
    country: cf.country ?? null,
    countryCode: cf.country ?? null,
    state: cf.region ?? null,
    state2: cf.regionCode ?? null,
    city: cf.city ?? null,
    postal: cf.postalCode ?? null,
    latitude: lat,
    longitude: lon,
    coordinates: lat != null && lon != null ? `${lat}, ${lon}` : null,
    timezone: cf.timezone ?? null,
    continentCode: cf.continent ?? null,
    isEU: cf.isEUCountry === '1',
    gdpr: cf.isEUCountry === '1',
    asn: cf.asn != null ? `AS${cf.asn}` : null,
    isp: cf.asOrganization ?? null,
    edgeColo: cf.colo ?? null,
    accuracy: lat != null ? 'City level (~10–50 km)' : null,
    source: 'cloudflare-edge',
    detected: true,
    // Signals the client that registry/RDAP/reverse-DNS fields are absent here and
    // a full report needs the origin.
    partial: true,
  };
}

/**
 * Security headers for statically served HTML.
 *
 * The Static Assets path never touches Express, so the headers server.js sets do
 * not apply here — without this, edge-served pages would ship with no CSP at all.
 * Kept deliberately in step with the CSP in server.js.
 *
 * CF_BEACON_TOKEN widens script-src/connect-src for Cloudflare Web Analytics only
 * when a token is configured, matching the origin's behaviour.
 */
function securityHeaders(env) {
  const analytics = Boolean(env.CF_BEACON_TOKEN);
  const csp = [
    "default-src 'self'",
    `script-src 'self'${analytics ? ' https://static.cloudflareinsights.com' : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
    "font-src 'self'",
    `connect-src 'self'${analytics ? ' https://cloudflareinsights.com' : ''}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

/**
 * Cache policy for Static Assets.
 *
 * Set here rather than in a `_headers` file so the policy is versioned with the
 * Worker and cannot silently stop applying. Vendored libraries are content-stable
 * and get a year; pages get a short TTL with a long stale-while-revalidate so a
 * redeploy propagates quickly without ever making a visitor wait on the origin.
 */
function withCacheHeaders(response, pathname, env) {
  const out = new Response(response.body, response);

  const isHtml = (out.headers.get('content-type') || '').includes('text/html');
  if (isHtml) {
    for (const [k, v] of Object.entries(securityHeaders(env))) out.headers.set(k, v);
  }

  if (pathname.startsWith('/vendor/')) {
    out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.(png|ico|svg|jpg|jpeg|webp|woff2?)$/i.test(pathname)) {
    out.headers.set('Cache-Control', 'public, max-age=2592000');
  } else if (/\.(css|js)$/i.test(pathname)) {
    out.headers.set('Cache-Control', 'public, max-age=604800');
  } else if (/^\/sitemap.*\.xml$|^\/robots\.txt$/.test(pathname)) {
    out.headers.set('Cache-Control', 'public, max-age=3600');
  } else {
    // HTML.
    out.headers.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=86400');
  }

  return out;
}

async function proxyToOrigin(request, env) {
  if (!env.ORIGIN) {
    return new Response(
      JSON.stringify({ error: 'Origin not configured. Set the ORIGIN var in wrangler.toml.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.ORIGIN);

  const headers = new Headers(request.headers);
  headers.set('host', new URL(env.ORIGIN).host);
  // Preserve the real client IP so the origin geolocates the visitor, not the edge.
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) {
    headers.set('x-forwarded-for', clientIp);
    headers.set('x-real-ip', clientIp);
  }
  headers.set('x-forwarded-proto', 'https');

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const out = new Response(upstream.body, upstream);
  if (NO_STORE.some((re) => re.test(url.pathname))) {
    out.headers.set('Cache-Control', 'no-store');
  }
  return out;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // One URL per page, decided before anything else looks at the path.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const canonical = canonicalPath(url.pathname);
      if (canonical) {
        return Response.redirect(new URL(canonical + url.search, url.origin).toString(), 301);
      }
    }

    // Fast path: the visitor's own geolocation, answered entirely at the edge.
    if (url.pathname === '/api/me' && request.method === 'GET' && env.EDGE_ME !== 'off') {
      const payload = meFromCf(request);
      if (payload) {
        return new Response(JSON.stringify(payload), {
          headers: {
            'content-type': 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      }
      // No usable cf data — fall through to the origin rather than guessing.
    }

    if (needsOrigin(url.pathname)) {
      return proxyToOrigin(request, env);
    }

    // Everything else is a static asset. `not_found_handling = "404-page"` in
    // wrangler.toml makes unknown paths serve dist/404.html with a 404 status.
    const asset = await env.ASSETS.fetch(request);
    return withCacheHeaders(asset, url.pathname, env);
  },
};
