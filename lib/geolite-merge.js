import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import maxmind from 'maxmind';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
let geoliteV4, geoliteV6;

export async function initGeolite() {
  const v4 = join(DATA_DIR, 'geolite2-city-ipv4.mmdb');
  const v6 = join(DATA_DIR, 'geolite2-city-ipv6.mmdb');
  if (existsSync(v4)) geoliteV4 = await maxmind.open(v4);
  if (existsSync(v6)) geoliteV6 = await maxmind.open(v6);
  return !!(geoliteV4 || geoliteV6);
}

export function geoliteLookup(ip) {
  const reader = ip.includes(':') ? geoliteV6 : geoliteV4;
  if (!reader) return null;
  const r = reader.get(ip);
  if (!r) return null;
  return {
    city: r.city ?? null,
    region: r.state1 ?? null,
    state2: r.state2 || null,
    postal: r.postcode || null,
    timezone: r.timezone || null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    countryCode: r.country_code ?? null,
  };
}

/** Fill gaps in primary geo record using GeoLite2 */
export function mergeGeolite(primary, ip) {
  const gl = geoliteLookup(ip);
  if (!gl) return primary;

  return {
    ...primary,
    city: primary.city || gl.city,
    region: primary.region || gl.region,
    state2: primary.state2 || gl.state2,
    postal: primary.postal || gl.postal,
    timezone: primary.timezone || gl.timezone,
    latitude: primary.latitude ?? gl.latitude,
    longitude: primary.longitude ?? gl.longitude,
    countryCode: primary.countryCode || gl.countryCode,
    geoliteMerged: true,
  };
}