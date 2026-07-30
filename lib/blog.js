/**
 * Blog post registry. Dates are hardcoded rather than derived so that rebuilding
 * or redeploying never silently changes a published date in the sitemap.
 */
export const POSTS = [
  {
    slug: 'why-ip-shows-wrong-city',
    title: 'Why Your IP Location Shows the Wrong City',
    description: 'IP geolocation put you in the wrong city. Here are the real reasons why — VPNs, ISP hubs, mobile carriers, stale registry data — and what you can actually do about it.',
    published: '2026-07-10',
    updated: '2026-07-10',
    tool: '/tools/timezone-check',
    readingMinutes: 7,
  },
  {
    slug: 'is-my-vpn-working',
    title: 'Is My VPN Working? Checks That Actually Prove It',
    description: 'A green "Connected" badge is not proof. Verify your VPN properly: IP change, DNS leaks, IPv6 leaks, WebRTC exposure, and timezone consistency.',
    published: '2026-07-12',
    updated: '2026-07-12',
    tool: '/tools/vpn-check',
    readingMinutes: 8,
  },
  {
    slug: 'how-to-check-ip-leak',
    title: 'How to Check If Your IP Is Leaking',
    description: 'Your VPN can show as connected while your real IP escapes through IPv6, DNS, or WebRTC. How to test each leak path and read the results.',
    published: '2026-07-14',
    updated: '2026-07-14',
    tool: '/tools/vpn-check',
    readingMinutes: 7,
  },
  {
    slug: 'ipv4-vs-ipv6',
    title: 'IPv4 vs IPv6: What Is Actually Different',
    description: 'The practical differences between IPv4 and IPv6 — address format, address space, NAT, privacy extensions, and why you often have both at once.',
    published: '2026-07-16',
    updated: '2026-07-16',
    tool: '/',
    readingMinutes: 8,
  },
  {
    slug: 'what-can-someone-do-with-your-ip',
    title: 'What Can Someone Actually Do With Your IP Address?',
    description: 'A calm, accurate look at what an IP address does and does not reveal, what the real risks are, and which common fears are overstated.',
    published: '2026-07-18',
    updated: '2026-07-18',
    tool: '/',
    readingMinutes: 7,
  },
  {
    slug: 'how-accurate-is-ip-geolocation',
    title: 'How Accurate Is IP Geolocation, Really?',
    description: 'Where IP geolocation data comes from, why country accuracy is strong but city accuracy is not, and when you should not rely on it at all.',
    published: '2026-07-21',
    updated: '2026-07-21',
    tool: '/',
    readingMinutes: 7,
  },
  {
    slug: 'what-is-an-asn',
    title: 'What Is an ASN? Autonomous Systems Explained',
    description: 'What an Autonomous System Number is, how BGP uses it to route traffic, and how to read the ASN attached to an IP address.',
    published: '2026-07-23',
    updated: '2026-07-23',
    tool: '/tools/vpn-check',
    readingMinutes: 6,
  },
  {
    slug: 'public-vs-private-ip',
    title: 'Public vs Private IP Addresses',
    description: 'The difference between the address your router shows you and the one the internet sees, which ranges are private, and why NAT sits between them.',
    published: '2026-07-25',
    updated: '2026-07-25',
    tool: '/',
    readingMinutes: 6,
  },
  {
    slug: 'why-does-my-ip-change',
    title: 'Why Does My IP Address Keep Changing?',
    description: 'Dynamic versus static addressing, DHCP lease renewal, CGNAT, mobile handoffs, and how to tell whether your ISP will ever give you a fixed address.',
    published: '2026-07-28',
    updated: '2026-07-28',
    tool: '/',
    readingMinutes: 6,
  },
];

export const POST_BY_SLUG = new Map(POSTS.map((p) => [p.slug, p]));

export function blogPath(slug) {
  return `/blog/${slug}`;
}
