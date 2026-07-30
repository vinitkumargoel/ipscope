import { escapeHtml } from '../escape.js';

/* ── Local theme toggle (tool pages do not depend on layout.js) ── */
function wireThemeToggle() {
  document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      try {
        localStorage.setItem('ipscope-theme', dark ? 'light' : 'dark');
      } catch (e) {
        /* storage unavailable — theme still applied for this page */
      }
    }),
  );
}

/* ── Element handles ── */
const el = {};
const IDS = [
  'tz-error', 'tz-ip-input', 'tz-check-btn', 'tz-me-btn', 'tz-copy-btn',
  'tz-verdict-tile', 'tz-verdict', 'tz-verdict-sub',
  'tz-browser-zone', 'tz-browser-offset', 'tz-browser-time',
  'tz-ip-zone', 'tz-ip-offset', 'tz-ip-time',
  'tz-ip-address', 'tz-ip-location', 'tz-ip-network',
  'tz-delta', 'tz-delta-sub',
];

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

/** Current state, so the live clock can keep rendering without refetching. */
const state = {
  browserZone: null,
  browserOffsetMin: null,
  ipZone: null,
  ipOffsetMin: null,
  ipOffsetLabel: null,
  ipLocalTimeFallback: null,
  verdict: 'UNKNOWN',
  testedIp: null,
};

/* ── Helpers ── */

function showError(message) {
  if (!el['tz-error']) return;
  el['tz-error'].textContent = message;
  el['tz-error'].classList.add('show');
}

function clearError() {
  if (!el['tz-error']) return;
  el['tz-error'].textContent = '';
  el['tz-error'].classList.remove('show');
}

function setText(id, value) {
  if (el[id]) el[id].textContent = value == null || value === '' ? '—' : String(value);
}

function setHtml(id, html) {
  if (el[id]) el[id].innerHTML = html;
}

function looksLikeIp(value) {
  if (IPV4.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255 && !/^0\d/.test(part));
  }
  return value.includes(':') && IPV6.test(value) && value.length >= 3;
}

/** "+05:30" style label from a signed minute count. */
function offsetLabel(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

/** Minutes east of UTC for an IANA zone name, or null if the zone is unusable. */
function offsetMinutesForZone(zone) {
  if (!zone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    return parseOffsetString(name);
  } catch (e) {
    return null;
  }
}

/** Parses "GMT", "GMT+2", "GMT+05:30", "UTC-4", "+05:30" into signed minutes. */
function parseOffsetString(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (/^(GMT|UTC|Z)$/i.test(text)) return 0;
  const match = text.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const mins = Number(match[3] ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return sign * (hours * 60 + mins);
}

function clockInZone(zone) {
  if (!zone) return null;
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return null;
  }
}

/** Clock for a fixed offset, used when we have an offset but no usable zone name. */
function clockAtOffset(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const shifted = new Date(Date.now() + minutes * 60000);
  return [shifted.getUTCHours(), shifted.getUTCMinutes(), shifted.getUTCSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

function formatDelta(hours) {
  const rounded = Math.round(hours * 100) / 100;
  const abs = Math.abs(rounded);
  const unit = abs === 1 ? 'hour' : 'hours';
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? '+' : '-'}${abs} ${unit}`;
}

/* ── Rendering ── */

function readBrowserSide() {
  let zone = null;
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch (e) {
    zone = null;
  }
  // getTimezoneOffset() is minutes *behind* UTC, so invert it.
  const raw = new Date().getTimezoneOffset();
  state.browserZone = zone;
  state.browserOffsetMin = Number.isFinite(raw) ? -raw : null;

  setHtml('tz-browser-zone', escapeHtml(zone || 'Not reported'));
  setText('tz-browser-offset', offsetLabel(state.browserOffsetMin) || 'Unknown');
}

function renderIpSide(data) {
  state.testedIp = data.ip ?? null;
  state.ipZone = data.timezone ?? null;
  state.ipOffsetLabel = data.utcOffset ?? null;
  state.ipLocalTimeFallback = data.localTime ?? null;

  // Prefer deriving the offset from the IANA zone; fall back to the API's label.
  state.ipOffsetMin = offsetMinutesForZone(state.ipZone);
  if (state.ipOffsetMin == null) state.ipOffsetMin = parseOffsetString(state.ipOffsetLabel);

  setHtml('tz-ip-zone', escapeHtml(state.ipZone || 'No timezone on record'));
  setText('tz-ip-offset', offsetLabel(state.ipOffsetMin) || state.ipOffsetLabel || 'Unknown');
  setText('tz-ip-address', data.ip);

  const place = [data.city, data.state, data.country].filter(Boolean).join(', ');
  setText('tz-ip-location', place);

  const network = [data.isp, data.asn].filter(Boolean).join(' · ');
  setText('tz-ip-network', network);
}

function renderVerdict() {
  const tile = el['tz-verdict-tile'];
  const browserOk = state.browserOffsetMin != null;
  const ipOk = state.ipOffsetMin != null;

  let verdict = 'UNKNOWN';
  let sub = '';
  let cls = 'unknown';

  if (!browserOk || !ipOk) {
    sub = !ipOk
      ? 'No timezone is recorded for this IP address, so the two values cannot be compared.'
      : 'Your browser did not report a usable timezone offset, so the two values cannot be compared.';
    setText('tz-delta', 'Not available');
    setText('tz-delta-sub', 'One of the two timezones is missing.');
  } else {
    const deltaMin = state.ipOffsetMin - state.browserOffsetMin;
    const deltaHours = deltaMin / 60;
    setText('tz-delta', formatDelta(deltaHours));

    if (deltaMin === 0) {
      verdict = 'MATCH';
      cls = 'match';
      const sameZone = state.browserZone && state.ipZone && state.browserZone === state.ipZone;
      sub = sameZone
        ? 'Your browser timezone and your IP timezone are the same zone. Nothing about your clock stands out.'
        : 'The zone names differ but both are currently on the same UTC offset, so the two clocks agree right now. They may diverge when daylight saving changes.';
      setText('tz-delta-sub', 'The two clocks read the same time.');
    } else {
      verdict = 'MISMATCH';
      cls = 'mismatch';
      const ahead = deltaMin > 0 ? 'ahead of' : 'behind';
      sub = `Your IP timezone is ${formatDelta(Math.abs(deltaHours)).replace('+', '')} ${ahead} your browser timezone. This is the signal most commonly used to flag VPN and proxy traffic — see below for the innocent explanations.`;
      setText('tz-delta-sub', 'A non-zero gap is what fraud and geo-blocking systems look for.');
    }
  }

  state.verdict = verdict;
  setText('tz-verdict', verdict);
  setText('tz-verdict-sub', sub);
  if (tile) {
    tile.classList.remove('match', 'mismatch', 'unknown');
    tile.classList.add(cls);
  }
}

function tickClocks() {
  const browserNow = state.browserZone
    ? clockInZone(state.browserZone)
    : clockAtOffset(state.browserOffsetMin);
  setText('tz-browser-time', browserNow);

  const ipNow = state.ipZone
    ? clockInZone(state.ipZone) || clockAtOffset(state.ipOffsetMin)
    : clockAtOffset(state.ipOffsetMin) || state.ipLocalTimeFallback;
  setText('tz-ip-time', ipNow);
}

/* ── Data loading ── */

function setBusy(busy) {
  [el['tz-check-btn'], el['tz-me-btn']].forEach((b) => {
    if (b) b.disabled = busy;
  });
}

async function load(url, label) {
  clearError();
  setBusy(true);
  setText('tz-verdict', 'Checking…');
  setText('tz-verdict-sub', `Looking up ${label}.`);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) {
      throw new Error((data && data.error) || `Lookup failed with status ${res.status}`);
    }
    renderIpSide(data);
    renderVerdict();
    tickClocks();
  } catch (err) {
    showError(`Could not check ${label}: ${err && err.message ? err.message : 'unknown error'}`);
    setText('tz-verdict', 'UNKNOWN');
    setText('tz-verdict-sub', 'The IP lookup did not complete, so no comparison was made.');
    if (el['tz-verdict-tile']) {
      el['tz-verdict-tile'].classList.remove('match', 'mismatch');
      el['tz-verdict-tile'].classList.add('unknown');
    }
  } finally {
    setBusy(false);
  }
}

function loadMine() {
  if (el['tz-ip-input']) el['tz-ip-input'].value = '';
  return load('/api/me', 'your own IP address');
}

function loadEntered() {
  const value = (el['tz-ip-input']?.value || '').trim();
  if (!value) {
    showError('Enter an IPv4 or IPv6 address to test, or use "Use my own IP".');
    return;
  }
  if (!looksLikeIp(value)) {
    showError(`"${value}" does not look like an IPv4 or IPv6 address.`);
    return;
  }
  load(`/api/lookup/${encodeURIComponent(value)}`, value);
}

function copyResult() {
  const lines = [
    `Timezone check: ${state.verdict}`,
    `Browser timezone: ${state.browserZone || 'not reported'} (${offsetLabel(state.browserOffsetMin) || 'unknown'})`,
    `IP address: ${state.testedIp || 'unknown'}`,
    `IP timezone: ${state.ipZone || 'not on record'} (${offsetLabel(state.ipOffsetMin) || state.ipOffsetLabel || 'unknown'})`,
    `Offset difference: ${el['tz-delta'] ? el['tz-delta'].textContent : 'unknown'}`,
  ].join('\n');

  const done = () => {
    if (!el['tz-copy-btn']) return;
    const original = el['tz-copy-btn'].textContent;
    el['tz-copy-btn'].textContent = 'Copied';
    setTimeout(() => {
      el['tz-copy-btn'].textContent = original;
    }, 1500);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(lines).then(done, () => {
      showError('The browser refused clipboard access. Select the values above and copy manually.');
    });
  } else {
    showError('This browser does not expose a clipboard API. Select the values above and copy manually.');
  }
}

/* ── Init ── */

function init() {
  wireThemeToggle();
  IDS.forEach((id) => {
    el[id] = document.getElementById(id);
  });

  if (!el['tz-verdict']) return; // not this page

  readBrowserSide();
  tickClocks();
  setInterval(tickClocks, 1000);

  el['tz-check-btn']?.addEventListener('click', loadEntered);
  el['tz-me-btn']?.addEventListener('click', loadMine);
  el['tz-copy-btn']?.addEventListener('click', copyResult);
  el['tz-ip-input']?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadEntered();
    }
  });

  // Allow /tools/timezone-check?ip=1.1.1.1 to preload a specific address.
  let preset = null;
  try {
    preset = new URLSearchParams(window.location.search).get('ip');
  } catch (e) {
    preset = null;
  }
  if (preset && looksLikeIp(preset.trim())) {
    if (el['tz-ip-input']) el['tz-ip-input'].value = preset.trim();
    loadEntered();
  } else {
    loadMine();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
