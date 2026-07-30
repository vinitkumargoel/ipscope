/**
 * Sitemap and robots.txt generation, shared by the Express server and the static
 * export so the two can never advertise different URL sets.
 */
import { SITE, PAGES } from './site-config.js';
import { loadView, hasView, newestLastmod } from './views.js';
import { escapeHtml, absUrl } from './render.js';
import { POSTS } from './blog.js';
import { asnIndexAvailable, listIndexedAsns, listIndexedCountries } from './programmatic.js';

export function urlset(entries) {
  const urls = entries
    .map(
      ({ loc, lastmod }) =>
        `  <url><loc>${escapeHtml(absUrl(loc))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function sitemapIndex(children) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children
  .map(
    (c) =>
      `  <sitemap><loc>${escapeHtml(absUrl(c.loc))}</loc>${c.lastmod ? `<lastmod>${c.lastmod}</lastmod>` : ''}</sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;
}

export function pageEntries() {
  return PAGES.filter((p) => hasView(p.view)).map((p) => ({
    loc: p.path,
    lastmod: loadView(p.view).lastmod,
  }));
}

export function blogEntries() {
  return POSTS.filter((p) => hasView(`blog/${p.slug}`)).map((p) => ({
    loc: `/blog/${p.slug}`,
    lastmod: p.updated,
  }));
}

/**
 * @param asns Optional explicit ASN list. The static export passes the set it
 *   actually wrote, so the sitemap can never advertise a page that the asset
 *   budget dropped. Omitted (the Express server), it lists everything indexed.
 */
export function asnEntries(asns) {
  return (asns ?? listIndexedAsns()).map((n) => ({ loc: `/asn/AS${n}` }));
}

export function countryEntries() {
  return listIndexedCountries().map((cc) => ({ loc: `/country/${cc.toLowerCase()}` }));
}

export function indexChildren() {
  const children = [
    { loc: '/sitemap-pages.xml', lastmod: newestLastmod(PAGES.map((p) => p.view)) },
  ];

  const blog = blogEntries();
  if (blog.length) {
    children.push({ loc: '/sitemap-blog.xml', lastmod: blog.map((b) => b.lastmod).sort().pop() });
  }

  if (asnIndexAvailable()) {
    const generated = newestLastmod(PAGES.map((p) => p.view));
    children.push({ loc: '/sitemap-asn.xml', lastmod: generated });
    children.push({ loc: '/sitemap-country.xml', lastmod: generated });
  }

  return children;
}

export function robotsTxt() {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${SITE.url}/sitemap.xml`, ''].join('\n');
}
