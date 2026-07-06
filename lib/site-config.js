export const SITE = {
  name: 'IPScope',
  tagline: 'Your IP Location & Geolocation Details',
  description: 'Free IP geolocation lookup — see your public IPv4 and IPv6 address, city, ISP, timezone, ASN, and map. Self-hosted offline MMDB, no API keys required.',
  url: process.env.SITE_URL || 'https://ip.vinitk.dev',
  email: process.env.SITE_EMAIL || 'legal@vinitk.dev',
  dmcaEmail: process.env.DMCA_EMAIL || 'legal@vinitk.dev',
  author: 'IPScope',
  locale: 'en_US',
  twitter: '@ipscope',
};

export const LEGAL_PAGES = [
  { path: '/privacy', title: 'Privacy Policy', file: 'privacy.html' },
  { path: '/terms', title: 'Terms of Service', file: 'terms.html' },
  { path: '/cookies', title: 'Cookie Policy', file: 'cookies.html' },
  { path: '/dmca', title: 'DMCA Policy', file: 'dmca.html' },
  { path: '/comment-policy', title: 'Comment Policy', file: 'comment-policy.html' },
  { path: '/disclaimer', title: 'Disclaimer', file: 'disclaimer.html' },
  { path: '/about', title: 'About', file: 'about.html' },
  { path: '/contact', title: 'Contact', file: 'contact.html' },
  { path: '/faq', title: 'FAQ', file: 'faq.html' },
  { path: '/api-docs', title: 'API Documentation', file: 'api-docs.html' },
  { path: '/tools/bulk-lookup', title: 'Bulk IP Lookup', file: 'tools/bulk-lookup.html' },
];