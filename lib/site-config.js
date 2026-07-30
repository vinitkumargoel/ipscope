export const SITE = {
  name: 'IPScope',
  tagline: 'Your IP Location & Geolocation Details',
  description: 'Free IP geolocation lookup — see your public IPv4 and IPv6 address, city, ISP, timezone, ASN, and map. Self-hosted offline MMDB, no API keys required.',
  url: process.env.SITE_URL || 'https://ip.vinitk.dev',
  email: process.env.SITE_EMAIL || 'legal@vinitk.dev',
  dmcaEmail: process.env.DMCA_EMAIL || 'legal@vinitk.dev',
  author: 'IPScope',
  locale: 'en_US',
  // Only emitted when set — an unowned handle is worse than no handle.
  twitter: process.env.SITE_TWITTER || '',
  repo: 'https://github.com/vinitkumargoel/ipscope',
  ogImage: '/og/default.png',
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
    bing: process.env.BING_SITE_VERIFICATION || '',
  },
  // Cloudflare Web Analytics beacon token. Cookie-free, so it needs no consent gate.
  cfBeaconToken: process.env.CF_BEACON_TOKEN || '',
};

/**
 * Single source of truth for every statically-routed page.
 *
 *   path        canonical URL path
 *   view        basename in views/ holding the <main> inner HTML
 *   group       footer column: product | legal | company | tools
 *   label       footer link text (omit to keep it out of the footer)
 *   layout      'app' for the homepage bento shell, 'page' otherwise
 *   priority    used only to order the footer, not emitted in the sitemap
 */
export const PAGES = [
  {
    path: '/',
    view: 'home',
    layout: 'app',
    group: 'product',
    label: 'What is my IP?',
    title: 'What Is My IP? — IPScope | Free IP Geolocation Lookup',
    description: 'See your public IP address instantly. Free IPv4 and IPv6 geolocation — city, country, ISP, timezone, ASN, map. Self-hosted offline lookup, no API keys.',
    h1: 'Know your IP.\nKnow where the web sees you.',
    tagline: 'Instant geolocation for your broadband connection — country, city, ISP, timezone, and map. Resolved entirely on this server with no third-party APIs.',
  },
  {
    path: '/tools/timezone-check',
    view: 'tools-timezone-check',
    group: 'tools',
    label: 'Timezone check',
    title: 'Timezone Check — Browser Timezone vs IP Timezone | IPScope',
    description: 'Free timezone dissonance test. Compare your browser timezone against your IP location timezone to spot VPN leaks, proxy mismatches, and spoofed system clocks.',
    h1: 'Timezone check',
    tagline: 'Does your browser timezone match the timezone of your IP address? A mismatch is the most common way VPN users get flagged.',
  },
  {
    path: '/tools/vpn-check',
    view: 'tools-vpn-check',
    group: 'tools',
    label: 'VPN & proxy check',
    title: 'VPN Detection Test — Is My IP a VPN, Proxy or Datacenter? | IPScope',
    description: 'Check whether an IP address looks like a VPN, proxy, Tor exit node, or hosting/datacenter range. Free VPN detection test with ASN and reverse-DNS evidence.',
    h1: 'VPN & proxy check',
    tagline: 'See whether your IP looks like a consumer broadband connection or a VPN, proxy, or datacenter range — and why.',
  },
  {
    path: '/tools/reverse-dns',
    view: 'tools-reverse-dns',
    group: 'tools',
    label: 'Reverse DNS',
    title: 'Reverse DNS Lookup — PTR Record Checker (IPv4 & IPv6) | IPScope',
    description: 'Free reverse DNS lookup. Resolve the PTR record for any IPv4 or IPv6 address to find its hostname, and see what the hostname reveals about the network.',
    h1: 'Reverse DNS lookup',
    tagline: 'Resolve the PTR record for any IPv4 or IPv6 address and see what the hostname tells you about the network behind it.',
  },
  {
    path: '/tools/abuse-contact',
    view: 'tools-abuse-contact',
    group: 'tools',
    label: 'Abuse contact',
    title: 'IP Abuse Contact Lookup — Report a Malicious IP | IPScope',
    description: 'Find the abuse contact email for any IP address via RDAP. Look up the responsible network operator, registry, and abuse mailbox to report malicious traffic.',
    h1: 'Abuse contact lookup',
    tagline: 'Find the right abuse mailbox for an IP address, straight from the regional registry via RDAP.',
  },
  {
    path: '/tools/bulk-lookup',
    view: 'tools-bulk-lookup',
    group: 'tools',
    label: 'Bulk lookup',
    title: 'Bulk IP Lookup — Geolocate Multiple IP Addresses at Once | IPScope',
    description: 'Look up many IP addresses at once. Bulk IPv4 and IPv6 geolocation with country, city, ISP and ASN for each, exportable to CSV. No signup, no API key.',
    h1: 'Bulk IP lookup',
    tagline: 'Paste a list of IPv4 or IPv6 addresses and geolocate them in one pass. Export the results as CSV or JSON.',
  },
  {
    path: '/api-docs',
    view: 'api-docs',
    group: 'product',
    label: 'API docs',
    title: 'Free IP Geolocation API — No API Key Required | IPScope',
    description: 'IPScope REST API documentation. Look up your own IP, any IPv4/IPv6 address, or a batch of addresses. JSON responses, no API key, no signup.',
    h1: 'API documentation',
    tagline: 'REST JSON API for IP geolocation. No API key required.',
  },
  {
    path: '/faq',
    view: 'faq',
    group: 'product',
    label: 'FAQ',
    title: 'IP Address FAQ — Geolocation Accuracy, IPv6 & VPNs | IPScope',
    description: 'Frequently asked questions about IP addresses, geolocation accuracy, IPv6, VPN detection, timezone mismatches, and how IPScope resolves lookups offline.',
    h1: 'Frequently asked questions',
    tagline: 'How IP geolocation works, how accurate it is, and what IPScope can and cannot tell you.',
  },
  {
    path: '/blog',
    view: 'blog-index',
    group: 'product',
    label: 'Blog',
    title: 'IPScope Blog — IP Addresses, Geolocation & VPN Guides',
    description: 'Practical guides on IP addresses and geolocation: why your IP shows the wrong city, how to check whether your VPN is working, IPv4 vs IPv6, and more.',
    h1: 'Blog',
    tagline: 'Plain-English guides to IP addresses, geolocation accuracy, and VPN behaviour.',
  },
  {
    path: '/about',
    view: 'about',
    group: 'company',
    label: 'About',
    title: 'About IPScope — Self-Hosted IP Geolocation',
    description: 'About IPScope: a self-hosted IP geolocation tool using offline MMDB databases. No API keys, IPv4 and IPv6, city-level accuracy.',
    h1: 'About IPScope',
    tagline: 'Self-hosted IP geolocation — private, fast, and offline-first.',
  },
  {
    path: '/contact',
    view: 'contact',
    group: 'company',
    label: 'Contact',
    title: 'Contact — IPScope',
    description: 'Contact IPScope for support, privacy requests, DMCA notices, and data correction inquiries.',
    h1: 'Contact',
    tagline: 'Get in touch with the IPScope team.',
  },
  {
    path: '/privacy',
    view: 'privacy',
    group: 'legal',
    label: 'Privacy Policy',
    title: 'Privacy Policy — IPScope',
    description: 'IPScope Privacy Policy. Learn how we handle IP lookups, logs, cookies, and your data when using our self-hosted geolocation service.',
    h1: 'Privacy Policy',
    tagline: 'How IPScope collects, uses, and protects information.',
  },
  {
    path: '/terms',
    view: 'terms',
    group: 'legal',
    label: 'Terms of Service',
    title: 'Terms of Service — IPScope',
    description: 'IPScope Terms of Service. Acceptable use, rate limits, warranty disclaimers, and liability terms for the IP geolocation service and API.',
    h1: 'Terms of Service',
    tagline: 'The rules for using IPScope and its API.',
  },
  {
    path: '/cookies',
    view: 'cookies',
    group: 'legal',
    label: 'Cookie Policy',
    title: 'Cookie Policy — IPScope',
    description: 'IPScope Cookie Policy. Which cookies and local storage keys we use, what they do, and how to clear them.',
    h1: 'Cookie Policy',
    tagline: 'What we store in your browser, and why.',
  },
  {
    path: '/dmca',
    view: 'dmca',
    group: 'legal',
    label: 'DMCA',
    title: 'DMCA Policy — IPScope',
    description: 'IPScope DMCA policy. How to submit a copyright infringement notice or counter-notice, and what we do when we receive one.',
    h1: 'DMCA Policy',
    tagline: 'Copyright infringement notices and counter-notices.',
  },
  {
    path: '/comment-policy',
    view: 'comment-policy',
    group: 'legal',
    label: 'Comment Policy',
    title: 'Comment Policy — IPScope',
    description: 'IPScope comment and community policy. What is acceptable, what gets removed, and how moderation decisions are made.',
    h1: 'Comment Policy',
    tagline: 'Ground rules for community contributions.',
  },
  {
    path: '/disclaimer',
    view: 'disclaimer',
    group: 'legal',
    label: 'Disclaimer',
    title: 'Disclaimer — IPScope',
    description: 'IPScope disclaimer. IP geolocation is approximate, city-level at best, and must not be used as the sole basis for consequential decisions.',
    h1: 'Disclaimer',
    tagline: 'What IP geolocation data can and cannot be relied on for.',
  },
];

export const PAGE_BY_PATH = new Map(PAGES.map((p) => [p.path, p]));

/** Legacy `.html` filenames that must 301 to their clean URL. */
export const HTML_REDIRECTS = new Map([
  ['/index.html', '/'],
  ['/about.html', '/about'],
  ['/contact.html', '/contact'],
  ['/faq.html', '/faq'],
  ['/api-docs.html', '/api-docs'],
  ['/privacy.html', '/privacy'],
  ['/terms.html', '/terms'],
  ['/cookies.html', '/cookies'],
  ['/dmca.html', '/dmca'],
  ['/comment-policy.html', '/comment-policy'],
  ['/disclaimer.html', '/disclaimer'],
  ['/tools/bulk-lookup.html', '/tools/bulk-lookup'],
]);

/** Retained for callers that only care about the routable page list. */
export const LEGAL_PAGES = PAGES.filter((p) => p.path !== '/');

const FOOTER_GROUPS = [
  ['Product', 'product'],
  ['Tools', 'tools'],
  ['Legal', 'legal'],
  ['Company', 'company'],
];

export function footerColumns() {
  return FOOTER_GROUPS
    .map(([title, group]) => ({
      title,
      links: PAGES.filter((p) => p.group === group && p.label).map((p) => ({ href: p.path, label: p.label })),
    }))
    .filter((col) => col.links.length > 0);
}
