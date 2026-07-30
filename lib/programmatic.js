import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './site-config.js';
import { renderContentPage, escapeHtml, absUrl } from './render.js';
// Namespace import on purpose: getCountryName/COUNTRY_CODES are newer additions,
// and a named import would make the whole server fail to boot if country-meta.js
// is ever rolled back to a version without them.
import * as countryMeta from './country-meta.js';

const getCountryMeta = countryMeta.getCountryMeta;
const getCountryName = countryMeta.getCountryName ?? ((cc) => cc);

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const ASN_INDEX = join(DATA_DIR, 'asn-index.json');
const COUNTRY_INDEX = join(DATA_DIR, 'country-index.json');

// How many ASN pages get advertised in the sitemap. Pages still render for any
// ASN present in the index; this only bounds what we actively ask Google to crawl.
const SITEMAP_ASN_LIMIT = Number(process.env.SITEMAP_ASN_LIMIT) || 15000;

let asnIndex;
let countryIndex;

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(`Could not parse ${path}: ${err.message}`);
    return null;
  }
}

function asns() {
  if (asnIndex === undefined) asnIndex = readJson(ASN_INDEX);
  return asnIndex;
}

function countries() {
  if (countryIndex === undefined) countryIndex = readJson(COUNTRY_INDEX);
  return countryIndex;
}

export function asnIndexAvailable() {
  return Boolean(asns()?.asns);
}

export function listIndexedAsns() {
  const idx = asns();
  if (!idx?.asns) return [];
  // Largest networks first — those are the ones with real search demand.
  return Object.entries(idx.asns)
    .sort((a, b) => (b[1].ips4 || 0) - (a[1].ips4 || 0))
    .slice(0, SITEMAP_ASN_LIMIT)
    .map(([num]) => Number(num));
}

export function listIndexedCountries() {
  const idx = countries();
  return idx?.countries ? Object.keys(idx.countries).sort() : [];
}

const nf = new Intl.NumberFormat('en-US');

function fact(label, value) {
  if (value == null || value === '') return '';
  return `      <div class="fact">
        <div class="fact-label">${escapeHtml(label)}</div>
        <div class="fact-value">${escapeHtml(String(value))}</div>
      </div>`;
}

function factGrid(pairs) {
  const items = pairs.map(([l, v]) => fact(l, v)).filter(Boolean).join('\n');
  return items ? `    <div class="fact-grid">\n${items}\n    </div>` : '';
}

function table(headers, rows) {
  if (!rows.length) return '';
  return `    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
${rows
  .map((r) => `          <tr>${r.map((c) => `<td${c.wrap ? ' class="wrap"' : ''}>${c.html ?? escapeHtml(String(c.text ?? c))}</td>`).join('')}</tr>`)
  .join('\n')}
        </tbody>
      </table>
    </div>`;
}

// ───────────────────────────────── ASN pages ────────────────────────────────

export async function renderAsnPage(numStr) {
  const idx = asns();
  if (!idx?.asns) return null;

  const num = String(Number(numStr));
  const rec = idx.asns[num];
  if (!rec) return null;

  const org = rec.name || `AS${num}`;
  const countryList = (rec.countries || []).map((cc) => ({
    cc,
    name: getCountryName(cc) || cc,
  }));

  const title = `AS${num} — ${org} | ASN Details, IP Ranges & Network Info`;
  const description = [
    `AS${num} is the autonomous system operated by ${org}.`,
    rec.prefixes4 ? `It announces ${nf.format(rec.prefixes4)} IPv4 prefixes` : '',
    rec.ips4 ? `covering ${nf.format(rec.ips4)} addresses` : '',
    countryList.length ? `across ${countryList.length} ${countryList.length === 1 ? 'country' : 'countries'}.` : '.',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+\./g, '.');

  const prefixRows = (rec.top || []).map((cidr) => [
    { html: `<code>${escapeHtml(cidr)}</code>` },
    { text: cidr.includes(':') ? 'IPv6' : 'IPv4' },
    { html: `<a href="/lookup/${escapeHtml(cidr.split('/')[0])}">Look up first address</a>` },
  ]);

  const countryRows = countryList.map((c) => [
    { html: `<a href="/country/${escapeHtml(c.cc.toLowerCase())}">${escapeHtml(c.name)}</a>` },
    { text: c.cc },
  ]);

  const body = `${factGrid([
    ['ASN', `AS${num}`],
    ['Organisation', org],
    ['IPv4 prefixes', rec.prefixes4 ? nf.format(rec.prefixes4) : null],
    ['IPv4 addresses', rec.ips4 ? nf.format(rec.ips4) : null],
    ['IPv6 prefixes', rec.prefixes6 ? nf.format(rec.prefixes6) : null],
    ['Countries', countryList.length || null],
  ])}

    <h2>What AS${escapeHtml(num)} is</h2>
    <p>AS${escapeHtml(num)} is an <strong>autonomous system</strong> — a block of IP address space and routing policy operated as a single unit, in this case by ${escapeHtml(org)}. Autonomous systems are how the internet is actually stitched together: each one announces the address ranges it is responsible for into the global BGP routing table, and every other network uses those announcements to decide where to send traffic.</p>
    <p>When an IP address is described as "belonging to" a provider, what is usually meant is that the address falls inside a prefix announced by that provider's ASN. If you are new to the concept, we explain it from scratch in <a href="/blog/what-is-an-asn">what is an ASN</a>.</p>

    <h2>Announced prefixes</h2>
    <p>${rec.prefixes4 || rec.prefixes6 ? `This network announces ${[rec.prefixes4 ? `${nf.format(rec.prefixes4)} IPv4 ${rec.prefixes4 === 1 ? 'prefix' : 'prefixes'}` : '', rec.prefixes6 ? `${nf.format(rec.prefixes6)} IPv6 ${rec.prefixes6 === 1 ? 'prefix' : 'prefixes'}` : ''].filter(Boolean).join(' and ')}. The largest are listed below.` : 'No prefixes are recorded for this ASN in the current dataset.'}</p>
${table(['Prefix', 'Family', 'Lookup'], prefixRows)}
    <p>This is a sample of the largest prefixes rather than the complete list, and it reflects a database snapshot rather than the live routing table. Prefixes are announced and withdrawn continuously, so treat this as a good approximation and not as authoritative BGP data.</p>

${countryRows.length ? `    <h2>Where AS${escapeHtml(num)} operates</h2>
    <p>Address space announced by this ASN is registered against the following ${countryRows.length === 1 ? 'country' : 'countries'}. A network can announce space registered in one country while physically serving traffic in another, which is one of the reasons IP geolocation disagrees with reality more often than people expect.</p>
${table(['Country', 'Code'], countryRows)}` : ''}

    <h2>Checking a specific address</h2>
    <p>An ASN describes a whole network, so it cannot tell you about one address on its own. To see the city, ISP record, timezone, reverse DNS and registry contact for a particular address in this network, run it through the <a href="/">IP lookup</a> — or paste a whole list into the <a href="/tools/bulk-lookup">bulk lookup</a>.</p>
    <p>If you are trying to work out whether traffic from this network is a VPN, proxy, or datacentre connection, the <a href="/tools/vpn-check">VPN and proxy check</a> shows the reasoning behind that classification. To report abusive traffic, the <a href="/tools/abuse-contact">abuse contact lookup</a> finds the responsible mailbox from the registry.</p>

    <h2>How this page is built</h2>
    <p>The figures here come from offline ASN and country databases held on this server, refreshed when the databases are rebuilt. Nothing on this page is fetched from a third-party API at request time. Because the underlying data is a snapshot, recently transferred address space may still show its previous holder.</p>`;

  const virtualPage = {
    path: `/asn/AS${num}`,
    title,
    description,
    h1: `AS${num} — ${org}`,
    tagline: `Autonomous system details, announced prefixes, and address counts for ${org}.`,
  };

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `AS${num} (${org}) network details`,
      description,
      url: absUrl(`/asn/AS${num}`),
      creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
      isAccessibleForFree: true,
      keywords: [`AS${num}`, org, 'ASN', 'IP ranges', 'autonomous system'],
    },
  ];

  return renderContentPage(virtualPage, {
    bodyHtml: body,
    jsonLd,
    breadcrumbs: [{ name: `AS${num}`, path: `/asn/AS${num}` }],
  });
}

// ─────────────────────────────── country pages ──────────────────────────────

export async function renderCountryPage(cc) {
  const idx = countries();
  if (!idx?.countries) return null;

  const rec = idx.countries[cc];
  if (!rec) return null;

  const name = getCountryName(cc) || cc;
  const meta = getCountryMeta(cc) || {};

  const title = `${name} IP Address Ranges — ASNs, ISPs & Geolocation | ${SITE.name}`;
  const description = [
    `IP address ranges registered to ${name} (${cc}).`,
    rec.prefixes4 ? `${nf.format(rec.prefixes4)} IPv4 prefixes` : '',
    rec.ips4 ? `covering ${nf.format(rec.ips4)} addresses` : '',
    rec.asnCount ? `across ${nf.format(rec.asnCount)} networks,` : '',
    'with the largest ISPs and autonomous systems listed.',
  ]
    .filter(Boolean)
    .join(' ');

  const asnRows = (rec.topAsns || []).map(([num, ips, asnName]) => [
    { html: `<a href="/asn/AS${escapeHtml(String(num))}">AS${escapeHtml(String(num))}</a>` },
    { text: asnName || `AS${num}`, wrap: true },
    { text: ips ? nf.format(ips) : '—' },
  ]);

  const body = `${factGrid([
    ['Country', name],
    ['ISO code', cc],
    ['IPv4 prefixes', rec.prefixes4 ? nf.format(rec.prefixes4) : null],
    ['IPv4 addresses', rec.ips4 ? nf.format(rec.ips4) : null],
    ['IPv6 prefixes', rec.prefixes6 ? nf.format(rec.prefixes6) : null],
    ['Networks (ASNs)', rec.asnCount ? nf.format(rec.asnCount) : null],
    ['Capital', meta.capital],
    ['Currency', meta.currency],
    ['Calling code', meta.callingCode],
    ['Languages', meta.languages],
    ['Region', meta.region],
    ['ccTLD', meta.tld],
    ['GDPR applies', meta.isEU ? 'Yes (EU member state)' : null],
  ])}

    <h2>IP address space registered to ${escapeHtml(name)}</h2>
    <p>${rec.prefixes4 ? `Roughly ${nf.format(rec.prefixes4)} IPv4 prefixes — about ${nf.format(rec.ips4 || 0)} individual addresses — are registered against ${escapeHtml(name)} in the datasets this site uses.` : `Address space registered against ${escapeHtml(name)} is recorded in the datasets this site uses.`} ${rec.asnCount ? `That space is spread across roughly ${nf.format(rec.asnCount)} autonomous systems.` : ''}</p>
    <p>Registration is not the same as physical location. Address space is allocated to an organisation by a regional internet registry, and that organisation is free to route it wherever it operates. A block registered in one country can serve users in a dozen others, which is a large part of why country-level geolocation is reliable while city-level geolocation often is not.</p>

${asnRows.length ? `    <h2>Largest networks in ${escapeHtml(name)}</h2>
    <p>The autonomous systems below hold the most IPv4 address space registered to ${escapeHtml(name)}. In most countries the top entries are the incumbent telecoms operator and the largest mobile carriers, followed by hosting providers and content networks.</p>
${table(['ASN', 'Organisation', 'IPv4 addresses'], asnRows)}` : ''}

    <h2>How accurate is geolocation for ${escapeHtml(name)}?</h2>
    <p>Country-level accuracy is generally strong, because registry allocations are country-scoped and rarely ambiguous. City-level accuracy is a different matter: it depends on how much detail the local providers publish and how they route their subscribers. Countries where a few large carriers aggregate traffic through a small number of gateways tend to produce results clustered on those cities regardless of where the subscriber actually is.</p>
    <p>Mobile connections are consistently the least accurate. If a result places you in the wrong city, our write-up on <a href="/blog/why-ip-shows-wrong-city">why your IP location shows the wrong city</a> explains the usual causes, and <a href="/blog/how-accurate-is-ip-geolocation">how accurate is IP geolocation</a> covers where the data comes from in the first place.</p>

    <h2>Look up a specific address</h2>
    <p>To resolve a single address in ${escapeHtml(name)} — city, ISP, ASN, timezone, reverse DNS and registry contact — use the <a href="/">IP lookup</a>. For a list of addresses, the <a href="/tools/bulk-lookup">bulk lookup</a> handles them in one pass and exports to CSV. Everything is also available through the <a href="/api-docs">JSON API</a>, which needs no key.</p>

    <h2>Data sources and freshness</h2>
    <p>These figures come from offline country and ASN databases stored on this server and are refreshed when those databases are rebuilt. No third-party API is called when this page is served. Because the data is a snapshot, transfers between organisations and newly allocated ranges can take time to appear.</p>`;

  const virtualPage = {
    path: `/country/${cc.toLowerCase()}`,
    title,
    description,
    h1: `IP address ranges in ${name}`,
    tagline: `Registered IPv4 and IPv6 address space, the largest networks, and geolocation notes for ${name}.`,
  };

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${name} IP address ranges`,
      description,
      url: absUrl(`/country/${cc.toLowerCase()}`),
      creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
      isAccessibleForFree: true,
      spatialCoverage: { '@type': 'Country', name },
      keywords: [`${name} IP ranges`, `${cc} IP addresses`, 'ASN', 'IP geolocation'],
    },
  ];

  return renderContentPage(virtualPage, {
    bodyHtml: body,
    jsonLd,
    breadcrumbs: [{ name, path: `/country/${cc.toLowerCase()}` }],
  });
}
