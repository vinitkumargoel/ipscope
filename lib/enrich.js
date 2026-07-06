import { lookupIp } from './geoip.js';
import { mergeGeolite } from './geolite-merge.js';
import { lookupHostname } from './reverse-dns.js';
import { lookupRdap } from './rdap.js';
import { getCountryMeta } from './country-meta.js';
import { classifyIp, ipFormats } from './ip-formats.js';
import { resolveTimezone, utcOffsetFor, localTimeFor } from './timezone-resolver.js';
import { sunInfo } from './sun-times.js';
import { toDms, hemisphere, mapLinks, localDate } from './location-utils.js';
import { analyzeThreat } from './threat-detect.js';

export async function enrichLookup(ip, options = {}) {
  let geo = lookupIp(ip);
  if (geo.error) return geo;

  geo = mergeGeolite(geo, ip);

  const { ipType, isBogon, isGlobal } = classifyIp(ip);
  const formats = ipFormats(ip);

  let hostname = null;
  let rdap = null;

  if (!geo.private) {
    [hostname, rdap] = await Promise.all([
      lookupHostname(ip),
      lookupRdap(ip),
    ]);
  }

  const timezone = resolveTimezone(geo.timezone, geo.latitude, geo.longitude, geo.countryCode);
  const utcOffset = utcOffsetFor(timezone);
  const localTime = localTimeFor(timezone);
  const countryMeta = getCountryMeta(geo.countryCode);
  const sun = sunInfo(geo.latitude, geo.longitude, timezone);
  const links = mapLinks(geo.latitude, geo.longitude);

  const coordinates = geo.latitude != null && geo.longitude != null
    ? `${geo.latitude.toFixed(4)}°, ${geo.longitude.toFixed(4)}°`
    : null;

  const coordinatesDms = geo.latitude != null && geo.longitude != null
    ? `${toDms(geo.latitude, true)}, ${toDms(geo.longitude, false)}`
    : null;

  const isp = geo.isp || rdap?.rdapDescription || rdap?.rdapName || null;
  const network = geo.network || rdap?.rdapCidr || null;
  const connection = geo.connection ?? (isp ? guessConnection(isp) : null);
  const threat = analyzeThreat({
    isp,
    asn: geo.asn,
    connection,
    proxyChain: options.proxyChain,
    rdapDescription: rdap?.rdapDescription,
    rdapName: rdap?.rdapName,
  });

  return {
    ...geo,
    ...formats,
    ipType,
    isBogon,
    isGlobal,
    timezone,
    utcOffset,
    localTime,
    localDate: localDate(timezone),
    coordinates,
    coordinatesDms,
    hemisphere: hemisphere(geo.latitude),
    hostname,
    isp,
    network,
    connection,
    ...threat,
    postal: geo.postal || null,
    state2: geo.state2 || null,
    registry: rdap?.registry ?? null,
    rdapName: rdap?.rdapName ?? null,
    rdapHandle: rdap?.rdapHandle ?? null,
    rdapType: rdap?.rdapType ?? null,
    rdapStatus: rdap?.rdapStatus ?? null,
    rdapDescription: rdap?.rdapDescription ?? null,
    rdapRange: rdap?.rdapRange ?? null,
    rdapCidr: rdap?.rdapCidr ?? null,
    rdapRegistered: rdap?.rdapRegistered ?? null,
    rdapUpdated: rdap?.rdapUpdated ?? null,
    whoisServer: rdap?.whoisServer ?? null,
    abuseEmail: rdap?.abuseEmail ?? null,
    techEmail: rdap?.techEmail ?? null,
    parentNetwork: rdap?.parentHandle ?? null,
    currency: countryMeta?.currency ?? null,
    callingCode: countryMeta?.callingCode ?? null,
    capital: countryMeta?.capital ?? null,
    languages: countryMeta?.languages ?? null,
    continentCode: countryMeta?.continentCode ?? null,
    worldRegion: countryMeta?.region ?? null,
    countryTld: countryMeta?.tld ?? null,
    isEU: countryMeta?.isEU ?? false,
    gdpr: countryMeta?.gdpr ?? false,
    dayNight: sun?.dayNight ?? null,
    sunrise: sun?.sunrise ?? null,
    sunset: sun?.sunset ?? null,
    mapOpenStreetMap: links?.openStreetMap ?? null,
    mapGoogle: links?.googleMaps ?? null,
    accuracy: geo.latitude ? 'City level (~10–50 km)' : null,
  };
}

function guessConnection(isp) {
  const lower = isp.toLowerCase();
  if (/amazon|google|microsoft|cloudflare|digitalocean|linode|ovh|hetzner|akamai|hosting|datacenter|server|vultr/.test(lower)) {
    return 'Datacenter';
  }
  if (/mobile|cellular|wireless|4g|5g|lte/.test(lower)) return 'Mobile';
  return 'Broadband';
}