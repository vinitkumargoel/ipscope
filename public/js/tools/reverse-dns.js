/**
 * Reverse DNS (PTR) lookup tool.
 * Reads the `hostname` field returned by /api/me and /api/lookup/:ip — that field
 * is the first PTR name resolved server-side by lib/reverse-dns.js.
 */
import { escapeHtml } from '../escape.js';

/* ── Theme toggle (kept local so tool pages do not depend on layout.js) ── */
document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('ipscope-theme', dark ? 'light' : 'dark'); } catch (e) {}
  }));

/* ── Hostname token dictionary (heuristic, not authoritative) ── */
const TOKEN_HINTS = [
  { tokens: ['dsl', 'adsl', 'vdsl', 'dslam', 'pppoe', 'ppp'], hint: 'DSL / dial-up style access' },
  { tokens: ['cable', 'cbl', 'docsis', 'hfc', 'cm'], hint: 'Cable modem access' },
  { tokens: ['fibre', 'fiber', 'ftth', 'fttb', 'fttx', 'gpon', 'pon', 'epon'], hint: 'Fibre access' },
  { tokens: ['dyn', 'dynamic', 'dynamicip', 'pool', 'dhcp', 'dial', 'dyndsl'], hint: 'Dynamically assigned address' },
  { tokens: ['static', 'fixed', 'fix'], hint: 'Static assignment' },
  { tokens: ['mobile', 'mob', 'cellular', 'gprs', 'umts', 'lte', 'wireless', 'wifi', 'wimax', '3g', '4g', '5g'], hint: 'Mobile or fixed-wireless network' },
  { tokens: ['vps', 'srv', 'server', 'host', 'hosted', 'hosting', 'cloud', 'colo', 'dedi', 'dedicated', 'node', 'instance'], hint: 'Hosting or datacentre infrastructure' },
  { tokens: ['cust', 'customer', 'client', 'user', 'res', 'resi', 'residential', 'home', 'broadband', 'bb', 'subscriber'], hint: 'Customer access line' },
  { tokens: ['mail', 'mx', 'smtp', 'imap', 'pop', 'pop3'], hint: 'Mail host — named deliberately' },
  { tokens: ['ns', 'ns1', 'ns2', 'dns', 'resolver'], hint: 'Name server' },
  { tokens: ['www', 'web', 'cdn', 'edgecache', 'cache', 'proxy'], hint: 'Web or caching infrastructure' },
  { tokens: ['gw', 'gateway', 'core', 'edge', 'bdr', 'bras', 'router', 'rtr', 'agg', 'nat', 'cgn', 'cgnat'], hint: 'Network infrastructure or aggregation point' },
  { tokens: ['vpn', 'tor', 'exit', 'relay', 'anon'], hint: 'Tunnel, relay, or exit node naming' },
  { tokens: ['unassigned', 'unused', 'reserved', 'nohost', 'noreverse', 'undefined', 'spare'], hint: 'Placeholder name — the operator marks this address as unallocated' },
];

/* Words too generic to prove that a hostname and a registry record agree. */
const CORPORATE_WORDS = new Set([
  'inc', 'ltd', 'llc', 'gmbh', 'corp', 'corporation', 'limited', 'company',
  'plc', 'sarl', 'holdings', 'holding', 'group', 'the', 'and', 'aps', 'oyj',
]);

const state = { current: null, busy: false };
const els = {};

function isProbablyIp(value) {
  const v = value.trim();
  if (!v) return false;
  if (v.includes(':')) return /^[0-9a-f:.]+$/i.test(v) && (v.match(/:/g) || []).length >= 2;
  const parts = v.split('.');
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add('show');
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = '';
  els.error.classList.remove('show');
}

function setBusy(busy) {
  state.busy = busy;
  if (els.button) {
    els.button.disabled = busy;
    els.button.textContent = busy ? 'Resolving…' : 'Look up';
  }
}

function showSkeleton(ip) {
  if (!els.results) return;
  els.results.innerHTML = `
    <div class="tile wide-tile loading">
      <div class="tile-label">PTR record</div>
      <div class="skeleton"></div>
      <div class="tile-sub">Resolving reverse DNS for ${escapeHtml(ip || 'your address')}…</div>
    </div>`;
}

/** Split a hostname into comparable lowercase tokens. */
function hostTokens(hostname) {
  return hostname
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/* Two-label public suffixes common enough to matter when guessing the domain. */
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'net.nz',
  'co.jp', 'ne.jp', 'or.jp', 'co.kr', 'com.cn', 'net.cn', 'com.hk', 'com.sg', 'com.tw',
  'co.in', 'net.in', 'org.in', 'co.za', 'com.br', 'net.br', 'com.mx', 'com.ar',
  'com.tr', 'com.pl', 'com.ua', 'co.il', 'com.my', 'co.th', 'com.ph', 'com.vn',
]);

/** Rough guess at the registered domain — the operator-owned tail of the name. */
function baseDomain(hostname) {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return TWO_LABEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/**
 * Does the hostname embed the address itself? Compares the address groups against
 * the hostname with separators removed, so 203-0-113-45 and 2001-4860-4860--8888
 * both match. Zero-compressed IPv6 written out in full will not match; that is an
 * accepted miss rather than a guess.
 */
function embedsAddress(hostname, ip) {
  if (!ip) return false;
  const host = hostname.toLowerCase();
  const flat = host.replace(/[^a-z0-9]/g, '');
  const groups = ip.toLowerCase().split(ip.includes(':') ? ':' : '.').filter(Boolean);
  if (groups.length < 2) return false;

  const forward = groups.join('');
  const backward = groups.slice().reverse().join('');
  if (forward.length >= 6 && (flat.includes(forward) || flat.includes(backward))) return true;

  return ['-', '.', '_'].some(
    (sep) => host.includes(groups.join(sep)) || host.includes(groups.slice().reverse().join(sep)),
  );
}

function collectHints(hostname, data) {
  const tokens = new Set(hostTokens(hostname));
  const hints = [];

  TOKEN_HINTS.forEach((entry) => {
    const matched = entry.tokens.filter((t) => tokens.has(t));
    if (matched.length) hints.push({ label: matched.join(', '), hint: entry.hint });
  });

  if (embedsAddress(hostname, data.ip)) {
    hints.push({ label: 'address in name', hint: 'Auto-generated from the IP address for the whole block' });
  }

  const geoWords = [data.city, data.state, data.country, data.countryCode]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .filter((v) => v.length >= 2);

  const geoMatch = geoWords.find((word) => tokens.has(word));
  if (geoMatch) {
    hints.push({ label: geoMatch, hint: 'Matches the geolocation record for this address' });
  }

  return { hints, geoMatch: geoMatch || null };
}

function tile(label, valueHtml, subHtml, extraClass = '') {
  return `
    <div class="tile${extraClass ? ` ${extraClass}` : ''}">
      <div class="tile-label">${escapeHtml(label)}</div>
      <div class="tile-value">${valueHtml}</div>
      ${subHtml ? `<div class="tile-sub">${subHtml}</div>` : ''}
    </div>`;
}

function ptrTile(data) {
  const hostname = data.hostname;
  if (hostname) {
    return `
    <div class="tile wide-tile">
      <div class="tile-label">PTR record</div>
      <div class="tile-value lg">${escapeHtml(hostname)}</div>
      <div class="tile-sub">Resolved for ${escapeHtml(data.ip || '')} · domain ${escapeHtml(baseDomain(hostname))}</div>
      <div class="tile-actions">
        <button type="button" class="tile-action-btn" data-copy="${escapeHtml(hostname)}">Copy hostname</button>
        <button type="button" class="tile-action-btn" data-copy="${escapeHtml(data.ip || '')}">Copy IP</button>
      </div>
    </div>`;
  }

  const bogon = data.isBogon || data.private;
  const sub = bogon
    ? 'This is a private, loopback, or otherwise reserved address. Reserved ranges have no meaningful public reverse DNS.'
    : 'No reverse DNS is published for this address, or the reverse zone did not answer within 2.5 seconds. This is normal for most residential and mobile addresses and does not indicate a problem — the only common case where it matters is outbound email.';

  return `
    <div class="tile wide-tile">
      <div class="tile-label">PTR record</div>
      <div class="tile-value lg">No PTR record</div>
      <div class="tile-sub">${escapeHtml(sub)}</div>
    </div>`;
}

function hintsTile(data) {
  if (!data.hostname) {
    return tile(
      'Hostname hints',
      'Nothing to read',
      'With no PTR record there is no name to interpret. Registry data via RDAP is the next best source — see the <a href="/tools/abuse-contact">abuse contact lookup</a>.',
      'wide-tile',
    );
  }

  const { hints } = collectHints(data.hostname, data);
  if (!hints.length) {
    return tile(
      'Hostname hints',
      'No recognised tokens',
      'The name does not contain any of the common access-technology or infrastructure abbreviations. That is not unusual; many operators use opaque internal naming.',
      'wide-tile',
    );
  }

  const tags = hints
    .map((h) => `<span class="ipv-tag on" title="${escapeHtml(h.hint)}">${escapeHtml(h.label)}</span>`)
    .join('');

  const lines = hints
    .map((h) => `<strong>${escapeHtml(h.label)}</strong> — ${escapeHtml(h.hint)}`)
    .join('<br>');

  return `
    <div class="tile wide-tile">
      <div class="tile-label">Hostname hints</div>
      <div class="ipv-tags">${tags}</div>
      <div class="tile-sub">${lines}<br><br>Pattern matching against common naming conventions. Hostnames are frequently stale, so treat every hint as evidence rather than proof.</div>
    </div>`;
}

function operatorTile(data) {
  const isp = data.isp || data.rdapName || null;
  const bits = [];
  if (data.asn) bits.push(escapeHtml(data.asn));
  if (data.network) bits.push(escapeHtml(data.network));
  if (data.registry) bits.push(`registry ${escapeHtml(data.registry)}`);

  let sub = bits.join(' · ');
  if (data.hostname && isp) {
    const tokens = new Set(hostTokens(data.hostname));
    const flatHost = data.hostname.toLowerCase().replace(/[^a-z0-9]/g, '');
    const ispWords = String(isp)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !CORPORATE_WORDS.has(w));
    const agrees = ispWords.some((w) => tokens.has(w) || flatHost.includes(w));
    sub += `<br>${agrees
      ? 'The hostname and the registry data name the same organisation.'
      : 'The hostname and the registry data do not obviously name the same organisation. Blocks that change hands often keep the old reverse-DNS template, and the registry record is usually the fresher of the two.'}`;
  }

  return tile('Network operator', escapeHtml(isp || 'Unknown'), sub || null);
}

function contextTile(data) {
  const place = [data.city, data.state, data.country].filter(Boolean).join(', ') || 'Unknown location';
  const sub = data.accuracy
    ? `${escapeHtml(data.accuracy)} — compare this with any city or airport code inside the hostname.`
    : 'No geolocation record for this address.';
  return tile('Geolocation for comparison', escapeHtml(place), sub);
}

function typeTile(data) {
  const value = data.connection || data.ipType || 'Unknown';
  const badges = [];
  if (data.isDatacenter) badges.push('datacenter');
  if (data.isMobile) badges.push('mobile');
  if (data.isResidential) badges.push('residential');
  if (data.isVpn) badges.push('vpn signal');
  if (data.isProxy) badges.push('proxy signal');
  if (data.isTor) badges.push('tor');

  const tags = badges.length
    ? `<div class="ipv-tags">${badges.map((b) => `<span class="ipv-tag on">${escapeHtml(b)}</span>`).join('')}</div>`
    : '';

  const sub = `${data.riskLabel ? `${escapeHtml(data.riskLabel)} · ` : ''}Deeper analysis on the <a href="/tools/vpn-check">VPN and proxy check</a>.`;

  return `
    <div class="tile">
      <div class="tile-label">Network type</div>
      <div class="tile-value">${escapeHtml(value)}</div>
      ${tags}
      <div class="tile-sub">${sub}</div>
    </div>`;
}

function addressTile(data) {
  const sub = [data.version, data.ipType].filter(Boolean).map(escapeHtml).join(' · ');
  return tile('Address looked up', escapeHtml(data.ip || '—'), sub || null);
}

function render(data) {
  if (!els.results) return;
  state.current = data;

  if (els.target) {
    els.target.textContent = data.detected ? `${data.ip} (your IP)` : data.ip || 'this address';
  }

  els.results.innerHTML = [
    ptrTile(data),
    hintsTile(data),
    addressTile(data),
    operatorTile(data),
    typeTile(data),
    contextTile(data),
  ].join('');
}

async function request(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    body = null;
  }
  if (!res.ok) {
    throw new Error((body && body.error) || `Lookup failed with status ${res.status}`);
  }
  if (!body) throw new Error('The server returned a response that could not be read as JSON.');
  if (body.error) throw new Error(body.error);
  return body;
}

async function lookup(ip) {
  if (state.busy) return;
  clearError();
  setBusy(true);
  showSkeleton(ip);
  try {
    const data = await request(`/api/lookup/${encodeURIComponent(ip)}`);
    render(data);
  } catch (err) {
    if (els.results) els.results.innerHTML = '';
    showError(`Could not resolve ${ip}: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

async function lookupSelf() {
  if (state.busy) return;
  clearError();
  setBusy(true);
  showSkeleton('');
  try {
    const data = await request('/api/me');
    if (els.input && data.ip) els.input.value = data.ip;
    render(data);
    if (data.needsClientDiscovery) {
      showError('This server sees a private address for your connection, so there is no public PTR record to resolve. Enter a public IP address above.');
    }
  } catch (err) {
    if (els.results) els.results.innerHTML = '';
    showError(`Could not detect your IP address: ${err.message}`);
  } finally {
    setBusy(false);
  }
}

function submit() {
  const value = els.input ? els.input.value.trim() : '';
  if (!value) {
    showError('Enter an IPv4 or IPv6 address to look up.');
    return;
  }
  if (!isProbablyIp(value)) {
    showError(`“${value}” does not look like an IPv4 or IPv6 address. This tool resolves addresses to hostnames, not the other way round.`);
    return;
  }
  clearError();
  lookup(value);
}

function copyValue(text, btn) {
  if (!text) return;
  const done = () => {
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      showError('The browser refused clipboard access. Select the text and copy it manually.');
    });
  } else {
    showError('This browser does not expose a clipboard API. Select the text and copy it manually.');
  }
}

function init() {
  els.input = document.getElementById('rdns-input');
  els.button = document.getElementById('rdns-lookup');
  els.error = document.getElementById('rdns-error');
  els.results = document.getElementById('rdns-results');
  els.target = document.getElementById('rdns-target');
  els.me = document.getElementById('rdns-me');

  if (!els.results || !els.input || !els.button) return;

  els.button.addEventListener('click', submit);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  if (els.me) els.me.addEventListener('click', lookupSelf);

  document.querySelectorAll('[data-rdns-example]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ip = btn.getAttribute('data-rdns-example');
      if (!ip) return;
      els.input.value = ip;
      lookup(ip);
    });
  });

  els.results.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    copyValue(btn.getAttribute('data-copy'), btn);
  });

  lookupSelf();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
