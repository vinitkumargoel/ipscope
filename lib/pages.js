/**
 * Shared page renderers. Both the Express server and scripts/build-static.js call
 * these, so a page can never render differently depending on how it was produced.
 */
import { SITE, PAGE_BY_PATH } from './site-config.js';
import { loadView, hasView } from './views.js';
import {
  renderContentPage,
  renderAppPage,
  renderAppHero,
  renderDocument,
  renderFooter,
  organizationSchema,
  webSiteSchema,
  escapeHtml,
  absUrl,
} from './render.js';
import { faqSchemaFromView } from './faq-schema.js';
import { POSTS, POST_BY_SLUG } from './blog.js';

export const HOME_H1 = 'Know your IP.<br>Know where the web sees you.';

export function homeJsonLd() {
  return [
    webSiteSchema(),
    organizationSchema(),
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'IPv4 lookup',
        'IPv6 lookup',
        'City geolocation',
        'ISP detection',
        'ASN lookup',
        'Timezone',
        'Reverse DNS',
        'VPN and proxy detection',
        'Bulk lookup',
        'Offline MMDB',
      ],
    },
  ];
}

export function renderHome() {
  const page = PAGE_BY_PATH.get('/');
  return renderAppPage(page, {
    heroHtml: renderAppHero({ h1Html: HOME_H1, tagline: page.tagline }),
    bodyHtml: loadView('home').html,
    jsonLd: homeJsonLd(),
    scripts: ['/js/app.js'],
  });
}

/** Tool pages ship their own module; content pages share page-init. */
export function scriptsForPage(page) {
  return page.path.startsWith('/tools/')
    ? [`/js/tools/${page.path.split('/').pop()}.js`]
    : ['/js/page-init.js'];
}

/**
 * Blog listing schema. Derived from the same POSTS registry that renders the index
 * and the sitemap, so the three cannot disagree about what has been published.
 */
export function blogIndexSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': absUrl('/blog'),
    name: `${SITE.name} Blog`,
    description: 'Guides on IP addresses, geolocation accuracy, VPNs and network routing.',
    url: absUrl('/blog'),
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    blogPost: POSTS.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url: absUrl(`/blog/${post.slug}`),
      datePublished: post.published,
      dateModified: post.updated,
      author: { '@type': 'Organization', name: SITE.author, url: SITE.url },
    })),
  };
}

export function renderRegisteredPage(page) {
  if (page.path === '/') return renderHome();

  const view = loadView(page.view);
  return renderContentPage(page, {
    bodyHtml: view.html,
    jsonLd: [
      page.path === '/blog' ? blogIndexSchema() : null,
      faqSchemaFromView(view.html),
    ].filter(Boolean),
    scripts: scriptsForPage(page),
  });
}

/**
 * The 404 page. Express renders it per-request with the path that missed;
 * scripts/build-static.js renders it once as dist/404.html, which Workers Static
 * Assets serves for unknown paths (`not_found_handling = "404-page"`). In the
 * static case there is no request path to echo, hence the optional argument.
 */
export function render404(requestPath) {
  const missing = requestPath
    ? `We could not find <code>${escapeHtml(requestPath)}</code>. It may have moved, or the address may be mistyped.`
    : 'That page does not exist. It may have moved, or the address may be mistyped.';

  const body = `  <div class="notfound">
    <h1>404</h1>
    <p>${missing}</p>
    <div class="notfound-links">
      <a class="action-btn" href="/">What is my IP?</a>
      <a class="action-btn" href="/tools/bulk-lookup">Bulk lookup</a>
      <a class="action-btn" href="/faq">FAQ</a>
      <a class="action-btn" href="/blog">Blog</a>
    </div>
  </div>`;

  return renderDocument({
    title: `Page not found — ${SITE.name}`,
    description: 'The page you requested does not exist.',
    // A 404 must not claim a canonical URL of its own; noindex carries the signal.
    canonical: requestPath || '/404',
    robots: 'noindex, follow',
    bodyHtml: `${body}\n\n${renderFooter()}`,
    scripts: ['/js/page-init.js'],
  });
}

export function renderBlogPost(slug) {
  const post = POST_BY_SLUG.get(slug);
  if (!post || !hasView(`blog/${slug}`)) return null;

  const view = loadView(`blog/${slug}`);

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated,
    author: { '@type': 'Organization', name: SITE.author, url: SITE.url },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: absUrl('/icon.svg') },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(`/blog/${slug}`) },
    image: absUrl(SITE.ogImage),
    inLanguage: 'en',
  };

  const virtualPage = {
    path: `/blog/${slug}`,
    title: `${post.title} | ${SITE.name}`,
    description: post.description,
    h1: post.title,
    tagline: `${post.readingMinutes} min read · Updated ${post.updated}`,
  };

  return renderContentPage(virtualPage, {
    bodyHtml: view.html,
    jsonLd: [article, faqSchemaFromView(view.html)].filter(Boolean),
    breadcrumbs: [
      { name: 'Blog', path: '/blog' },
      { name: post.title, path: `/blog/${slug}` },
    ],
    extraHead: `  <meta property="article:published_time" content="${escapeHtml(post.published)}">\n  <meta property="article:modified_time" content="${escapeHtml(post.updated)}">`,
  });
}
