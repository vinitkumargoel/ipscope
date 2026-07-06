import { escapeHtml } from './escape.js';

const RECENT_KEY = 'ipscope-recent';
const MAX_RECENT = 10;

export function copyText(text, btn) {
  if (!text || text === '—') return;
  navigator.clipboard.writeText(text).then(() => {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {});
}

export function saveRecent(ip, summary = {}) {
  if (!ip) return;
  const list = getRecent().filter((r) => r.ip !== ip);
  list.unshift({
    ip,
    city: summary.city ?? null,
    country: summary.country ?? null,
    ts: Date.now(),
  });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  renderRecentList();
}

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

export function renderRecentList(onSelect) {
  const el = document.getElementById('recent-list');
  if (!el) return;
  const list = getRecent();
  el.replaceChildren();
  if (!list.length) {
    const empty = document.createElement('span');
    empty.className = 'recent-empty';
    empty.textContent = 'No recent lookups';
    el.append(empty);
    return;
  }

  for (const r of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-item';
    btn.dataset.ip = r.ip;
    btn.append(r.ip);
    const label = [r.city, r.country].filter(Boolean).join(', ') || r.ip;
    const span = document.createElement('span');
    span.textContent = label;
    btn.append(span);
    btn.addEventListener('click', () => onSelect?.(r.ip));
    el.append(btn);
  }
}

export function exportJson(data, ip) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `ipscope-${(ip || 'lookup').replace(/:/g, '-')}.json`);
}

export function exportCsv(rows, filename = 'ipscope-bulk') {
  if (!rows?.length) return;
  const header = ['ip', 'city', 'region', 'country', 'countryCode', 'isp', 'asn', 'timezone', 'riskLabel', 'error'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    header.join(','),
    ...rows.map((r) => header.map((k) => escape(r[k])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function shareUrl(ip) {
  const base = window.location.origin;
  const url = ip ? `${base}/lookup/${encodeURIComponent(ip)}` : base;
  if (navigator.share) {
    navigator.share({ title: 'IPScope Lookup', url }).catch(() => copyText(url));
  } else {
    copyText(url);
  }
}

export function isValidIpClient(ip) {
  if (!ip || typeof ip !== 'string') return false;
  if (ip.includes(':')) {
    return /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i.test(ip) || /^::1$/.test(ip);
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

export function getLookupIpFromPath() {
  const m = window.location.pathname.match(/^\/lookup\/(.+)$/);
  if (!m) return null;
  const ip = decodeURIComponent(m[1]);
  return isValidIpClient(ip) ? ip : null;
}

export function updateShareUrl(ip) {
  if (!ip || ip === '—' || !isValidIpClient(ip)) return;
  const path = `/lookup/${encodeURIComponent(ip)}`;
  if (window.location.pathname !== path) {
    history.replaceState(null, '', path);
  }
}

export function printReport() {
  window.print();
}

let lastData = null;

export function setLastLookup(data) {
  lastData = data;
}

export function getLastLookup() {
  return lastData;
}