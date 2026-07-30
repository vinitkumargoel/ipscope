import { SITE, footerColumns } from './site-config.js';

const ROBOTS_DEFAULT = 'index, follow, max-image-preview:large';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function absUrl(path = '/') {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith('/') ? path : `/${path}`}`;
}

/** JSON-LD is injected inside a <script> element, so `<` and `&` must not survive. */
function jsonLdScript(blocks) {
  const list = (Array.isArray(blocks) ? blocks : [blocks]).filter(Boolean);
  if (!list.length) return '';
  return list
    .map((block) => {
      const json = JSON.stringify(block).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
      return `  <script type="application/ld+json">${json}</script>`;
    })
    .join('\n');
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: absUrl('/icon.svg'),
    description: SITE.description,
    sameAs: [SITE.repo].filter(Boolean),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.email,
      url: absUrl('/contact'),
    },
  };
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE.url}/lookup/{ip}` },
      'query-input': 'required name=ip',
    },
  };
}

export function breadcrumbSchema(trail = []) {
  if (!trail.length) return null;
  const items = [{ name: 'Home', path: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

function renderBreadcrumbNav(trail = []) {
  if (!trail.length) return '';
  const crumbs = [{ name: 'Home', path: '/' }, ...trail];
  const parts = crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    return last
      ? `<span aria-current="page">${escapeHtml(c.name)}</span>`
      : `<a href="${escapeHtml(c.path)}">${escapeHtml(c.name)}</a>`;
  });
  return `
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        ${parts.join('<span class="crumb-sep" aria-hidden="true">/</span>')}
      </nav>`;
}

export function renderFooter() {
  const year = new Date().getFullYear();
  const cols = footerColumns()
    .map(
      (col) => `
        <div class="footer-col">
          <h4>${escapeHtml(col.title)}</h4>
          <ul>${col.links
            .map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
            .join('')}</ul>
        </div>`,
    )
    .join('');

  return `
  <footer class="site-footer">
    <div class="site-footer-inner">
      <div class="footer-brand">
        <a class="logo" href="/">IP<span>Scope</span></a>
        <p>Self-hosted IP geolocation with offline MMDB databases. No third-party API keys. IPv4 and IPv6 supported.</p>
      </div>
      <div class="footer-cols">${cols}
      </div>
    </div>
    <div class="site-footer-bottom">
      <span>&copy; ${year} ${escapeHtml(SITE.name)}. Location data is approximate — city level, not your exact address.</span>
      <span class="footer-badges">
        <span>Offline MMDB</span>
        <span>IPv4 + IPv6</span>
        <span>No API keys</span>
      </span>
    </div>
  </footer>`;
}

function verificationTags() {
  const tags = [];
  if (SITE.verification.google) {
    tags.push(`  <meta name="google-site-verification" content="${escapeHtml(SITE.verification.google)}">`);
  }
  if (SITE.verification.bing) {
    tags.push(`  <meta name="msvalidate.01" content="${escapeHtml(SITE.verification.bing)}">`);
  }
  return tags.join('\n');
}

/**
 * Cloudflare Web Analytics. Cookie-free, so it adds no consent obligation.
 *
 * There is no same-origin path for this beacon — it must come from
 * static.cloudflareinsights.com, which is why server.js widens `script-src` and
 * `connect-src` to those hosts, but only when a token is actually configured.
 */
function analyticsScript() {
  if (!SITE.cfBeaconToken) return '';
  return `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${escapeHtml(SITE.cfBeaconToken)}"}'></script>`;
}

/**
 * Low-level document renderer. Everything SEO-critical lives here so no page can
 * silently ship without canonical, Open Graph, or Twitter tags.
 */
export function renderDocument({
  title,
  description,
  canonical = '/',
  robots = ROBOTS_DEFAULT,
  ogType = 'website',
  ogTitle,
  ogDescription,
  ogImage = SITE.ogImage,
  jsonLd = [],
  stylesheets = ['/css/bento.css', '/css/pages.css', '/css/seo.css'],
  preloads = [],
  extraHead = '',
  bodyClass = '',
  bodyHtml = '',
  scripts = [],
} = {}) {
  const canonicalUrl = absUrl(canonical);
  const imageUrl = absUrl(ogImage);

  const twitterSite = SITE.twitter
    ? `\n  <meta name="twitter:site" content="${escapeHtml(SITE.twitter)}">`
    : '';

  const scriptTags = scripts
    .map((s) => {
      if (typeof s === 'string') return `  <script type="module" src="${escapeHtml(s)}"></script>`;
      const attrs = [
        s.module ? 'type="module"' : '',
        s.defer ? 'defer' : '',
        s.async ? 'async' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `  <script ${attrs} src="${escapeHtml(s.src)}"></script>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(SITE.author)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="theme-color" content="#2563eb">
${verificationTags()}

  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:site_name" content="${escapeHtml(SITE.name)}">
  <meta property="og:title" content="${escapeHtml(ogTitle || title)}">
  <meta property="og:description" content="${escapeHtml(ogDescription || description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:locale" content="${escapeHtml(SITE.locale)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(ogTitle || title)}">

  <meta name="twitter:card" content="summary_large_image">${twitterSite}
  <meta name="twitter:title" content="${escapeHtml(ogTitle || title)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription || description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <link rel="preconnect" href="https://tile.openstreetmap.org" crossorigin>
  <link rel="dns-prefetch" href="https://tile.openstreetmap.org">
${preloads.map((p) => `  <link rel="preload" href="${escapeHtml(p.href)}" as="${escapeHtml(p.as)}"${p.type ? ` type="${escapeHtml(p.type)}"` : ''}${p.crossorigin ? ' crossorigin' : ''}>`).join('\n')}
${stylesheets.map((href) => `  <link rel="stylesheet" href="${escapeHtml(href)}">`).join('\n')}

  <script src="/js/theme-init.js"></script>
${jsonLdScript(jsonLd)}
${analyticsScript()}
${extraHead}
</head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
${bodyHtml}
${scriptTags}
</body>
</html>
`;
}

/** Compact hero used by every page except the homepage. */
function renderPageHero({ h1, tagline, breadcrumbs = [] }) {
  return `  <header class="page-hero">
    <div class="page-hero-inner">
      <nav class="page-hero-nav">
        <a class="logo" href="/">IP<span>Scope</span></a>
        <div class="page-hero-actions">
          <a class="back" href="/">← Back to lookup</a>
          <button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle dark mode">🌙</button>
        </div>
      </nav>${renderBreadcrumbNav(breadcrumbs)}
      <h1>${escapeHtml(h1)}</h1>
      <p>${escapeHtml(tagline)}</p>
    </div>
  </header>`;
}

/**
 * Standard content page: hero + <main> + server-rendered footer.
 * `bodyHtml` is the inner HTML of <main> and is trusted (it comes from views/).
 */
export function renderContentPage(page, { bodyHtml, jsonLd = [], breadcrumbs, scripts = [], extraHead = '' } = {}) {
  const trail = breadcrumbs ?? [{ name: page.h1, path: page.path }];
  const blocks = [breadcrumbSchema(trail), ...(Array.isArray(jsonLd) ? jsonLd : [jsonLd])].filter(Boolean);

  return renderDocument({
    title: page.title,
    description: page.description,
    canonical: page.path,
    ogImage: page.ogImage,
    jsonLd: blocks,
    extraHead,
    bodyHtml: `${renderPageHero({ h1: page.h1, tagline: page.tagline, breadcrumbs: trail })}

  <main class="page-content">
${bodyHtml}
  </main>

${renderFooter()}`,
    scripts: scripts.length ? scripts : ['/js/page-init.js'],
  });
}

const HERO_FEATURES = [
  ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', 'No API keys'],
  ['<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>', 'IPv4 &amp; IPv6'],
  ['M12 21s-7-4.5-7-11a7 7 0 1114 0c0 6.5-7 11-7 11z', 'City-level geo'],
  ['M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9', 'Lookup any IP'],
];

/**
 * Hero for the homepage and per-IP pages. `h1Html` is raw so it can carry a <br>;
 * callers pass escaped content for anything user-derived.
 */
export function renderAppHero({ h1Html, tagline, breadcrumbs = [] }) {
  const features = HERO_FEATURES.map(([shape, label]) => {
    const inner = shape.startsWith('<') ? shape : `<path d="${shape}"/>`;
    return `          <span class="hero-feature">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${inner}</svg>
            ${label}
          </span>`;
  }).join('\n');

  return `  <header class="hero">
    <div class="hero-inner">
      <nav class="hero-nav">
        <a class="logo" href="/">IP<span>Scope</span></a>
        <div class="hero-nav-actions">
          <span class="nav-badge">Offline · IPv4 + IPv6</span>
          <button type="button" class="theme-toggle" data-theme-toggle aria-label="Toggle dark mode">🌙</button>
        </div>
      </nav>${renderBreadcrumbNav(breadcrumbs)}
      <div class="hero-content">
        <h1>${h1Html}</h1>
        <p>${escapeHtml(tagline)}</p>
        <div class="hero-features">
${features}
        </div>
      </div>
    </div>
  </header>`;
}

/** Full-bleed app shell used by the homepage and per-IP lookup pages. */
export function renderAppPage(page, { bodyHtml, heroHtml, jsonLd = [], scripts = [], robots, canonical, title, description, extraHead = '' } = {}) {
  return renderDocument({
    title: title || page.title,
    description: description || page.description,
    canonical: canonical || page.path,
    robots,
    jsonLd,
    extraHead,
    bodyHtml: `${heroHtml}

  <main class="main">
${bodyHtml}
  </main>

${renderFooter()}`,
    scripts: scripts.length ? scripts : ['/js/app.js'],
  });
}
