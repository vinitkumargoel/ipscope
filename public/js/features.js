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
  if (!list.length) {
    el.innerHTML = '<span class="recent-empty">No recent lookups</span>';
    return;
  }
  el.innerHTML = list.map((r) => {
    const label = [r.city, r.country].filter(Boolean).join(', ') || r.ip;
    return `<button type="button" class="recent-item" data-ip="${r.ip}">${r.ip}<span>${label}</span></button>`;
  }).join('');

  el.querySelectorAll('.recent-item').forEach((btn) => {
    btn.addEventListener('click', () => onSelect?.(btn.dataset.ip));
  });
}

export function exportJson(data, ip) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ipscope-${(ip || 'lookup').replace(/:/g, '-')}.json`;
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

export function getLookupIpFromPath() {
  const m = window.location.pathname.match(/^\/lookup\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function updateShareUrl(ip) {
  if (!ip || ip === '—') return;
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