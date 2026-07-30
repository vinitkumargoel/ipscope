import { escapeHtml } from '../escape.js';

/* ── Local theme toggle (tool pages do not depend on layout.js) ── */
document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
  b.addEventListener('click', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
    try { localStorage.setItem('ipscope-theme', dark ? 'light' : 'dark'); } catch (e) {}
  })
);

const input = document.getElementById('abuse-ip');
const lookupBtn = document.getElementById('abuse-lookup-btn');
const meBtn = document.getElementById('abuse-me-btn');
const clearBtn = document.getElementById('abuse-clear-btn');
const errorEl = document.getElementById('abuse-error');
const resultsEl = document.getElementById('abuse-results');

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function clearError() {
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.remove('show');
}

function setBusy(busy) {
  if (lookupBtn) {
    lookupBtn.disabled = busy;
    lookupBtn.textContent = busy ? 'Looking up…' : 'Find contact';
  }
  if (meBtn) meBtn.disabled = busy;
}

/** Format an RDAP timestamp as UTC, falling back to the raw string. */
function fmtStamp(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function tile(label, value, options) {
  const opts = options || {};
  if (value === null || value === undefined || value === '') return '';
  const cls = opts.wide ? 'tile wide-tile' : 'tile';
  const valueCls = opts.mono ? 'tile-value sm' : 'tile-value';
  const sub = opts.sub ? `<div class="tile-sub">${escapeHtml(opts.sub)}</div>` : '';
  return `<div class="${cls}">
    <div class="tile-label">${escapeHtml(label)}</div>
    <div class="${valueCls}">${escapeHtml(value)}</div>
    ${sub}
  </div>`;
}

function abuseTile(data) {
  const email = data.abuseEmail;
  if (!email) {
    return `<div class="tile hero-tile">
      <div class="tile-label">Abuse mailbox</div>
      <div class="tile-value">Not published</div>
      <div class="tile-sub">This registration record does not list an abuse contact. Try the technical contact below, the parent network, or the operator's own security.txt page.</div>
    </div>`;
  }
  const safe = escapeHtml(email);
  return `<div class="tile hero-tile">
    <div class="tile-label">Abuse mailbox</div>
    <div class="tile-value lg"><a href="mailto:${safe}">${safe}</a><button type="button" class="copy-btn" data-copy="${safe}">Copy</button></div>
    <div class="tile-sub">Reaches the network operator responsible for this range, not the end user of the address.</div>
  </div>`;
}

function render(data) {
  if (!resultsEl) return;

  const network = data.rdapCidr || data.rdapRange || data.network;

  const html = `
    <div class="bento">
      <div class="bento-section">Abuse contact</div>
      ${abuseTile(data)}
      ${tile('Technical contact', data.techEmail, { mono: true })}
      ${tile('Registry', data.registry, { sub: data.whoisServer ? `WHOIS server: ${data.whoisServer}` : '' })}

      <div class="bento-section">Registered network</div>
      ${tile('Network name', data.rdapName, { sub: data.rdapDescription || '' })}
      ${tile('Handle', data.rdapHandle, { mono: true })}
      ${tile('CIDR', data.rdapCidr, { mono: true })}
      ${tile('Address range', data.rdapRange, { mono: true })}
      ${tile('Allocation type', data.rdapType)}
      ${tile('Status', data.rdapStatus)}
      ${tile('Parent network', data.parentNetwork, { mono: true, sub: 'Escalate here if the specific operator does not respond.' })}
      ${tile('Registered', fmtStamp(data.rdapRegistered), { mono: true })}
      ${tile('Last updated', fmtStamp(data.rdapUpdated), { mono: true })}

      <div class="bento-section">Context for your report</div>
      ${tile('IP address', data.ip, { sub: data.version || '' })}
      ${tile('Operator / ISP', data.isp, { sub: data.asn ? `AS: ${data.asn}` : '' })}
      ${tile('Country', data.country, { sub: data.countryCode || '' })}
      ${tile('Effective network', network, { mono: true })}
    </div>
    <p class="page-meta">Registration data describes who holds the range, not who sent the traffic. Include full timestamps with a timezone in any report you send.</p>
  `;

  resultsEl.innerHTML = html;
}

async function request(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Lookup failed (HTTP ${res.status})`);
  }
  if (!data) throw new Error('The server returned a response that could not be read.');
  return data;
}

async function lookup(ip) {
  const value = String(ip || '').trim();
  if (!value) {
    showError('Enter an IPv4 or IPv6 address to look up.');
    return;
  }
  clearError();
  setBusy(true);
  try {
    const data = await request(`/api/lookup/${encodeURIComponent(value)}`);
    render(data);
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = '';
    showError(err && err.message ? err.message : 'Lookup failed. Please try again.');
  } finally {
    setBusy(false);
  }
}

async function lookupSelf() {
  clearError();
  setBusy(true);
  try {
    const data = await request('/api/me');
    if (input && data.ip) input.value = data.ip;
    render(data);
  } catch (err) {
    if (resultsEl) resultsEl.innerHTML = '';
    showError(err && err.message ? err.message : 'Could not detect your IP address.');
  } finally {
    setBusy(false);
  }
}

if (lookupBtn && input && resultsEl) {
  lookupBtn.addEventListener('click', () => lookup(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      lookup(input.value);
    }
  });

  if (meBtn) meBtn.addEventListener('click', lookupSelf);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      resultsEl.innerHTML = '';
      clearError();
      input.focus();
    });
  }

  resultsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.copy-btn');
    if (!btn) return;
    const text = btn.getAttribute('data-copy') || '';
    if (!text || !navigator.clipboard) {
      showError('Clipboard access is unavailable in this browser. Select the address and copy it manually.');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = original; }, 1500);
      },
      () => showError('Could not write to the clipboard. Select the address and copy it manually.')
    );
  });

  // Allow deep links such as /tools/abuse-contact?ip=8.8.8.8
  const preset = new URLSearchParams(window.location.search).get('ip');
  if (preset) {
    input.value = preset.trim();
    lookup(preset);
  }
} else {
  showError('This tool could not start because the page markup is incomplete.');
}
