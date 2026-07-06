import { discoverPublicIps } from './discover-ip.js';
import { getBrowserInfo } from './browser-info.js';
import {
  copyText, saveRecent, renderRecentList, exportJson, shareUrl,
  getLookupIpFromPath, updateShareUrl, printReport, setLastLookup, getLastLookup,
} from './features.js';
import { renderSiteFooter, initCookieConsent, initTheme, toggleTheme } from './layout.js';

const FLAG = {
  IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷',
  JP: '🇯🇵', CN: '🇨🇳', AU: '🇦🇺', CA: '🇨🇦', BR: '🇧🇷',
  SG: '🇸🇬', NL: '🇳🇱', SE: '🇸🇪', RU: '🇷🇺', KR: '🇰🇷',
};

let map, marker, circle;
let myIpv4 = null;
let myIpv6 = null;
let myLocalIps = [];
let currentIp = null;

const $ = (id) => document.getElementById(id);

initTheme();
initCookieConsent();
$('site-footer-mount').innerHTML = renderSiteFooter();

document.querySelector('[data-theme-toggle]')?.addEventListener('click', toggleTheme);

function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.add('show');
}

function hideError() {
  $('error').classList.remove('show');
}

function setText(id, val, fallback = '—') {
  const el = $(id);
  if (el) el.textContent = (val != null && val !== '') ? val : fallback;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fe80:') || l.startsWith('fc') || l.startsWith('fd');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function initMap(lat, lng, label) {
  if (!lat || !lng) return;

  if (!map) {
    map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
  } else {
    map.setView([lat, lng], 11);
  }

  if (marker) map.removeLayer(marker);
  if (circle) map.removeLayer(circle);

  marker = L.marker([lat, lng]).addTo(map);
  circle = L.circle([lat, lng], { radius: 8000, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 2 }).addTo(map);

  setText('map-title', label);
  setText('map-coords', `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`);
}

function updateTimezone(tz, utcOffset, localTime) {
  setText('tile-timezone', tz);
  if (localTime && utcOffset) {
    setText('tile-time-sub', `${utcOffset} · ${localTime}`);
    setText('tile-localtime', localTime);
    setText('tile-utcoffset', utcOffset);
  } else if (tz) {
    try {
      const time = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
      setText('tile-time-sub', `${offset} · ${time}`);
      setText('tile-localtime', time);
      setText('tile-utcoffset', offset);
    } catch {
      setText('tile-time-sub', '—');
      setText('tile-localtime', '—');
      setText('tile-utcoffset', '—');
    }
  } else {
    setText('tile-time-sub', '—');
    setText('tile-localtime', '—');
    setText('tile-utcoffset', '—');
  }
}

function updateThreatBadge(data) {
  const el = $('tile-threat');
  if (!el || !data.riskLabel) {
    if (el) el.style.display = 'none';
    return;
  }
  el.style.display = 'inline-flex';
  el.className = `threat-badge ${data.riskLevel || 'low'}`;
  el.textContent = data.riskLabel;
}

function updateIpTiles(geoIp, isYou) {
  if (isYou) {
    setText('tile-ip-main', myIpv4 ?? (myIpv6 ? 'Discovering IPv4…' : '—'));
    setText('tile-ip-sub', myIpv6 ?? 'No IPv6 detected');
  } else {
    const isV6 = geoIp?.includes(':');
    setText('tile-ip-main', isV6 ? (myIpv4 ?? geoIp) : geoIp);
    setText('tile-ip-sub', isV6 ? geoIp : '—');
  }

  $('tag-v4').classList.toggle('on', !!myIpv4);
  $('tag-v4').classList.toggle('off', !myIpv4);
  $('tag-v6').classList.toggle('on', !!myIpv6);
  $('tag-v6').classList.toggle('off', !myIpv6);
}

function showBrowserSection(show) {
  const display = show ? '' : 'none';
  $('browser-section').style.display = display;
  document.querySelectorAll('.browser-only').forEach((el) => { el.style.display = display; });
  if (show) {
    const b = getBrowserInfo();
    setText('tile-browser', b.browser);
    setText('tile-os', b.os);
    setText('tile-device', b.device);
    setText('tile-screen', `${b.screen} · ${b.pixelRatio}`);
    setText('tile-browser-tz', b.browserTimezone);
    setText('tile-language', b.language);
    setText('tile-net-type', b.networkType ?? 'Unknown');
    setText('tile-downlink', b.downlink ?? '—');
    setText('tile-cores', String(b.cores));
    setText('tile-platform', b.platform);
    setText('tile-privacy', `${b.online ? 'Online' : 'Offline'} · Cookies ${b.cookies ? 'on' : 'off'} · DNT ${b.doNotTrack ? 'on' : 'off'}`);
    setText('tile-colorscheme', `${b.colorScheme} mode · ${b.secure ? 'HTTPS' : 'HTTP'}`);
  }
}

function showConnectionSection(show, data = {}) {
  const display = show ? '' : 'none';
  $('connection-section').style.display = display;
  document.querySelectorAll('.conn-only').forEach((el) => { el.style.display = display; });
  if (show) {
    setText('tile-proxy', data.proxyChain?.length ? data.proxyChain.join(' → ') : 'Direct (no proxy)');
    setText('tile-https', data.connectionSecure ? 'Secured (HTTPS)' : 'Not secured (HTTP)');
    setText('tile-local-ips', myLocalIps.length ? myLocalIps.join(', ') : 'None detected');
  }
}

function setMapLinks(osm, google) {
  const el = $('tile-map-links');
  if (!el) return;
  if (!osm && !google) {
    el.textContent = '—';
    return;
  }
  el.innerHTML = [
    osm ? `<a href="${osm}" target="_blank" rel="noopener" style="color:var(--blue)">OpenStreetMap</a>` : '',
    google ? `<a href="${google}" target="_blank" rel="noopener" style="color:var(--blue)">Google Maps</a>` : '',
  ].filter(Boolean).join(' · ');
}

function updatePageTitle(data, isYou) {
  const ip = data.ip ?? '';
  if (isYou) {
    document.title = 'What Is My IP? — IPScope | Free IP Geolocation Lookup';
  } else {
    const loc = [data.city, data.country].filter(Boolean).join(', ');
    document.title = loc ? `${ip} — ${loc} | IPScope` : `${ip} — IP Lookup | IPScope`;
  }
}

function renderData(data, isYou = true) {
  hideError();
  setLastLookup(data);

  const ip = data.ip ?? '—';
  currentIp = ip !== '—' ? ip : currentIp;

  $('toolbar-label').innerHTML = isYou
    ? 'Showing <span class="you">your</span> IP details'
    : `Lookup results for <span class="you">${ip}</span>`;

  updatePageTitle(data, isYou);
  updateIpTiles(ip, isYou);
  updateThreatBadge(data);
  showBrowserSection(isYou);
  showConnectionSection(isYou, data);

  const isPublic = !data.private;
  $('tag-public').textContent = isPublic ? 'Public' : 'Private';
  $('tag-public').classList.toggle('on', isPublic);
  $('tag-public').classList.toggle('warn', !isPublic);

  const cc = data.countryCode ?? '';
  $('tile-flag').textContent = FLAG[cc] ?? '🌐';
  setText('tile-country', data.country ?? (isPublic ? 'Unknown' : '—'));
  setText('tile-country-sub', cc ? `${cc}${data.continent ? ' · ' + data.continent : ''}` : '—');

  setText('tile-city', data.city ?? (isPublic ? 'Unknown' : '—'));
  setText('tile-city-sub', [data.region, data.postal].filter(Boolean).join(' · ') || '—');

  setText('tile-region', data.region ?? '—');
  setText('tile-district', data.state2 || '—', '—');
  setText('tile-postal', data.postal ?? 'Not in database');
  setText('tile-accuracy', data.accuracy ?? '—');
  setText('tile-coordinates', data.coordinates ?? '—');

  setText('tile-asn', data.asn ?? '—');
  setText('tile-isp', data.isp ?? (data.asn ? `Unknown (${data.asn})` : 'Unknown provider'));
  setText('tile-isp-sub', [data.connection, data.rdapName].filter(Boolean).join(' · ') || '—');

  setText('tile-network', data.network ?? '—');
  setText('tile-hostname', data.hostname ?? (isPublic ? 'No PTR record' : '—'));
  setText('tile-connection', data.connection ?? (data.asn ? 'Broadband' : '—'));
  setText('tile-decimal', data.ipDecimal != null ? String(data.ipDecimal) : '—');
  setText('tile-hex', data.ipHex ?? '—');
  setText('tile-iptype', data.ipType ?? '—');

  setText('tile-currency', data.currency ?? '—');
  setText('tile-calling', data.callingCode ?? '—');
  setText('tile-capital', data.capital ?? '—');
  setText('tile-languages', data.languages ?? '—');
  setText('tile-localdate', data.localDate ?? '—');
  setText('tile-daynight', data.dayNight ?? '—');
  setText('tile-sun', data.sunrise && data.sunset ? `↑ ${data.sunrise} · ↓ ${data.sunset}` : '—');
  setText('tile-hemisphere', data.hemisphere ?? '—');
  setText('tile-dms', data.coordinatesDms ?? '—');
  setText('tile-world-region', data.worldRegion ?? '—');
  setText('tile-continent-code', data.continentCode ? `Continent ${data.continentCode}` : '—');
  setText('tile-tld', data.countryTld ?? '—');
  setText('tile-gdpr', data.gdpr ? 'GDPR applies' : (data.isEU === false && data.countryCode ? 'Non-EU' : '—'));

  setText('tile-binary', data.ipBinary ?? '—');
  setText('tile-whois', data.whoisServer ?? '—');
  setText('tile-tech', data.techEmail ?? 'Not published');
  setText('tile-parent', data.parentNetwork ?? '—');
  setMapLinks(data.mapOpenStreetMap, data.mapGoogle);

  setText('tile-registry', data.registry ?? '—');
  setText('tile-rdap-type', data.rdapType ?? '—');
  setText('tile-rdap-name', data.rdapName ?? '—');
  setText('tile-rdap-range', data.rdapRange ?? '—');
  setText('tile-rdap-desc', data.rdapDescription ?? '—');
  setText('tile-abuse', data.abuseEmail ?? 'Not published');

  const dates = [data.rdapRegistered && `Registered ${data.rdapRegistered}`, data.rdapUpdated && `Updated ${data.rdapUpdated}`]
    .filter(Boolean).join(' · ');
  setText('tile-rdap-dates', dates || '—');

  updateTimezone(data.timezone, data.utcOffset, data.localTime);

  if (data.latitude && data.longitude) {
    const label = [data.city, data.country].filter(Boolean).join(', ') || 'Location';
    initMap(data.latitude, data.longitude, label);
  }

  if (ip && ip !== '—') {
    saveRecent(ip, { city: data.city, country: data.country });
    if (!isYou) updateShareUrl(ip);
  }

  if (data.error) showError(data.error);
  else if (data.message && !isYou) showError(data.message);
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

async function resolveMyPublicIps(serverData) {
  myIpv4 = serverData.ipv4 && !isPrivateIp(serverData.ipv4) ? serverData.ipv4 : null;
  myIpv6 = serverData.ipv6 && !isPrivateIp(serverData.ipv6) ? serverData.ipv6 : null;

  if (serverData.needsClientDiscovery || !myIpv4) {
    const discovered = await discoverPublicIps();
    if (!myIpv4 && discovered.ipv4) myIpv4 = discovered.ipv4;
    if (!myIpv6 && discovered.ipv6) myIpv6 = discovered.ipv6;
    myLocalIps = discovered.localIps ?? [];
  }
}

function pickGeoLookupIp() {
  if (myIpv4) return myIpv4;
  if (myIpv6) return myIpv6;
  return null;
}

async function loadMyIp() {
  document.querySelectorAll('.tile').forEach((t) => t.classList.add('loading'));
  hideError();
  $('toolbar-label').innerHTML = 'Detecting <span class="you">your</span> public IP…';

  try {
    const serverData = await fetchJson('/api/me');
    $('toolbar-label').innerHTML = 'Resolving <span class="you">your</span> location…';

    await resolveMyPublicIps(serverData);

    const geoIp = pickGeoLookupIp();
    if (!geoIp) {
      updateIpTiles(null, true);
      $('toolbar-label').innerHTML = 'Could not detect your public IP';
      showError('Could not detect your public IP. Check your network or enter your IP manually above.');
      return;
    }

    const geo = await fetchJson(`/api/lookup/${encodeURIComponent(geoIp)}`);
    renderData({ ...geo, proxyChain: serverData.proxyChain, connectionSecure: serverData.connectionSecure }, true);
    updateIpTiles(geoIp, true);
    history.replaceState(null, '', '/');
  } catch (e) {
    $('toolbar-label').innerHTML = 'Something went wrong';
    showError(e.message);
  } finally {
    document.querySelectorAll('.tile').forEach((t) => t.classList.remove('loading'));
  }
}

async function lookupIp(ip) {
  hideError();
  const btn = $('lookup-btn');
  btn.disabled = true;
  $('toolbar-label').innerHTML = `Looking up <span class="you">${ip}</span>…`;
  document.querySelectorAll('.tile').forEach((t) => t.classList.add('loading'));
  try {
    const data = await fetchJson(`/api/lookup/${encodeURIComponent(ip)}`);
    if (!ip.includes(':')) myIpv4 = ip;
    else myIpv6 = ip;
    $('lookup-input').value = ip;
    renderData(data, false);
    updateShareUrl(ip);
  } catch (e) {
    $('toolbar-label').innerHTML = 'Lookup failed';
    showError(e.message);
  } finally {
    btn.disabled = false;
    document.querySelectorAll('.tile').forEach((t) => t.classList.remove('loading'));
  }
}

$('lookup-btn').addEventListener('click', () => {
  const ip = $('lookup-input').value.trim();
  if (ip) lookupIp(ip);
  else loadMyIp();
});

$('lookup-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const ip = e.target.value.trim();
    if (ip) lookupIp(ip);
    else loadMyIp();
  }
});

$('btn-copy-ip').addEventListener('click', () => {
  const ip = currentIp || myIpv4 || myIpv6;
  copyText(ip, $('btn-copy-ip'));
});

$('btn-share').addEventListener('click', () => {
  shareUrl(currentIp || myIpv4 || myIpv6);
});

$('btn-export').addEventListener('click', () => {
  const data = getLastLookup();
  if (data) exportJson(data, currentIp || data.ip);
});

$('btn-print').addEventListener('click', printReport);
$('btn-refresh').addEventListener('click', loadMyIp);

renderRecentList((ip) => {
  $('lookup-input').value = ip;
  lookupIp(ip);
});

const pathIp = getLookupIpFromPath();
if (pathIp) {
  $('lookup-input').value = pathIp;
  lookupIp(pathIp);
} else {
  loadMyIp();
}