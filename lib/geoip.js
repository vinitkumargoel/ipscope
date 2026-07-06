import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import maxmind from 'maxmind';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

let cityV4, cityV6, asnDb, originAsnDb;

const COUNTRY_NAMES = {
  IN: 'India', US: 'United States', GB: 'United Kingdom', DE: 'Germany',
  FR: 'France', JP: 'Japan', CN: 'China', AU: 'Australia', CA: 'Canada',
  BR: 'Brazil', SG: 'Singapore', NL: 'Netherlands', SE: 'Sweden',
};

const CONTINENT = {
  IN: 'Asia', US: 'North America', GB: 'Europe', DE: 'Europe', FR: 'Europe',
  JP: 'Asia', CN: 'Asia', AU: 'Oceania', CA: 'North America', BR: 'South America',
  SG: 'Asia', NL: 'Europe', SE: 'Europe',
};

export function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  const parts = ip.split('.').map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  return false;
}

function ipToDecimal(ip) {
  if (ip.includes(':')) return null;
  return ip.split('.').map(Number).reduce((acc, p) => (acc << 8) + p, 0) >>> 0;
}

function ipv4ToCidr(ip, prefixLen) {
  const parts = ip.split('.').map(Number);
  const num = parts.reduce((acc, p) => (acc << 8) + p, 0) >>> 0;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const net = num & mask;
  return [
    (net >>> 24) & 255,
    (net >>> 16) & 255,
    (net >>> 8) & 255,
    net & 255,
  ].join('.') + `/${prefixLen}`;
}

function resolveNetwork(ip, cityReader, asnReader) {
  for (const reader of [cityReader, asnReader, originAsnDb]) {
    if (!reader) continue;
    try {
      const result = reader.getWithPrefixLength(ip);
      if (!result) continue;
      const [, prefix] = result;
      if (prefix == null) continue;
      if (ip.includes(':')) return `${ip}/${prefix}`;
      return ipv4ToCidr(ip, prefix);
    } catch {
      continue;
    }
  }
  return null;
}

function mergeAsn(originRec, dbipRec) {
  const num = originRec?.autonomous_system_number
    ?? dbipRec?.autonomous_system_number
    ?? dbipRec?.asn
    ?? null;
  const org = originRec?.autonomous_system_organization
    ?? dbipRec?.autonomous_system_organization
    ?? dbipRec?.as_name
    ?? dbipRec?.organization
    ?? null;
  return num || org ? { autonomous_system_number: num, autonomous_system_organization: org } : null;
}

function normalizeRecord(cityRec, asnRec, ip, network) {
  const isV6 = ip.includes(':');
  const countryCode = cityRec?.country?.iso_code
    ?? cityRec?.country_code
    ?? asnRec?.country
    ?? null;

  const region = cityRec?.subdivisions?.[0]?.names?.en
    ?? cityRec?.state1
    ?? cityRec?.region
    ?? null;

  const state2 = cityRec?.state2 || null;

  const city = cityRec?.city?.names?.en
    ?? cityRec?.city
    ?? null;

  const lat = cityRec?.location?.latitude ?? cityRec?.latitude ?? null;
  const lng = cityRec?.location?.longitude ?? cityRec?.longitude ?? null;

  const timezone = cityRec?.location?.time_zone ?? cityRec?.timezone ?? null;
  const postal = cityRec?.postal?.code ?? cityRec?.postcode ?? null;

  const asnNum = asnRec?.autonomous_system_number ?? asnRec?.asn ?? null;
  const isp = asnRec?.autonomous_system_organization
    ?? asnRec?.as_name
    ?? asnRec?.organization
    ?? null;

  return {
    ip,
    version: isV6 ? 'IPv6' : 'IPv4',
    private: isPrivateIp(ip),
    country: countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : null,
    countryCode,
    continent: countryCode ? (CONTINENT[countryCode] ?? null) : null,
    region,
    state2,
    city,
    postal: postal || null,
    latitude: lat,
    longitude: lng,
    timezone: timezone || null,
    utcOffset: timezone ? formatUtcOffset(timezone) : null,
    asn: asnNum ? `AS${asnNum}` : null,
    asnNumber: asnNum,
    isp,
    network,
    ipDecimal: ipToDecimal(ip),
    connection: guessConnection(isp, asnNum),
    source: 'offline-mmdb',
  };
}

function formatUtcOffset(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

function guessConnection(isp, asnNum) {
  if (isp) {
    const lower = isp.toLowerCase();
    if (/amazon|google|microsoft|cloudflare|digitalocean|linode|ovh|hetzner|akamai|hosting|datacenter|data center|server/.test(lower)) {
      return 'Datacenter';
    }
    if (/mobile|cellular|wireless|telecom|broadband|fiber|fibre|cable|dsl|isp|communications|jio|airtel|vodafone|comcast|verizon|att/.test(lower)) {
      return 'Broadband';
    }
    return 'Broadband';
  }
  if (asnNum) return 'Broadband';
  return null;
}

export async function initGeoIP() {
  const required = {
    cityV4: join(DATA_DIR, 'dbip-city-ipv4.mmdb'),
    cityV6: join(DATA_DIR, 'dbip-city-ipv6.mmdb'),
    asn: join(DATA_DIR, 'dbip-asn.mmdb'),
  };

  const missing = Object.entries(required).filter(([, p]) => !existsSync(p));
  if (missing.length) {
    console.warn('MMDB files missing. Run: npm run download-db');
    console.warn('Missing:', missing.map(([k]) => k).join(', '));
    return false;
  }

  cityV4 = await maxmind.open(required.cityV4);
  cityV6 = await maxmind.open(required.cityV6);
  asnDb = await maxmind.open(required.asn);

  const originPath = join(DATA_DIR, 'origin-asn.mmdb');
  if (existsSync(originPath)) {
    originAsnDb = await maxmind.open(originPath);
    console.log('GeoIP databases loaded (city + ASN + origin-asn).');
  } else {
    console.log('GeoIP databases loaded (city + ASN). origin-asn.mmdb missing — ISP names may be empty.');
  }

  return true;
}

export function lookupIp(ip) {
  if (!cityV4 || !cityV6 || !asnDb) {
    return { error: 'Database not loaded. Run npm run download-db' };
  }

  const isV6 = ip.includes(':');
  const cityReader = isV6 ? cityV6 : cityV4;
  const cityRec = cityReader.get(ip);
  const dbipAsn = asnDb.get(ip);
  const originRec = originAsnDb?.get(ip) ?? null;
  const asnRec = mergeAsn(originRec, dbipAsn);
  const network = resolveNetwork(ip, cityReader, asnDb);

  if (!cityRec && !asnRec && isPrivateIp(ip)) {
    return {
      ip,
      version: isV6 ? 'IPv6' : 'IPv4',
      private: true,
      country: null,
      countryCode: null,
      message: 'Private or local address — no geolocation available.',
      source: 'offline-mmdb',
    };
  }

  return normalizeRecord(cityRec, asnRec, ip, network);
}

export function extractClientIps(req) {
  const candidates = [];

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    candidates.push(...forwarded.split(',').map((s) => stripIpv6Mapped(s.trim())).filter(Boolean));
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) candidates.push(stripIpv6Mapped(realIp.trim()));
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) candidates.push(stripIpv6Mapped(cfIp.trim()));
  if (req.socket?.remoteAddress) {
    candidates.push(stripIpv6Mapped(req.socket.remoteAddress));
  }

  let ipv4 = null;
  let ipv6 = null;
  const connectionIp = candidates.at(-1) ?? null;

  for (const ip of candidates) {
    if (ip.includes(':')) {
      if (!ipv6 || (isPrivateIp(ipv6) && !isPrivateIp(ip))) ipv6 = ip;
    } else if (!ipv4 || (isPrivateIp(ipv4) && !isPrivateIp(ip))) {
      ipv4 = ip;
    }
  }

  return { ipv4, ipv6, connectionIp };
}

export function pickGeoIp({ ipv4, ipv6, connectionIp }) {
  if (ipv4 && !isPrivateIp(ipv4)) return ipv4;
  if (ipv6 && !isPrivateIp(ipv6)) return ipv6;
  return ipv4 ?? ipv6 ?? connectionIp;
}

export function extractClientIp(req) {
  const { ipv4, ipv6, connectionIp } = extractClientIps(req);
  return pickGeoIp({ ipv4, ipv6, connectionIp });
}

function stripIpv6Mapped(ip) {
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

export function isValidIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (ip.includes(':')) {
    return /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(ip) || /^::1$/.test(ip);
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}