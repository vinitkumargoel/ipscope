import { escapeHtml } from '../escape.js';

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

const el = (id) => document.getElementById(id);

let lastResult = null;

function isValidIp(value) {
  if (IPV4.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255);
  }
  return value.includes(':') && IPV6.test(value) && value.length <= 45;
}

function showError(message) {
  const banner = el('vpn-error');
  if (!banner) return;
  banner.textContent = message;
  banner.classList.add('show');
}

function clearError() {
  const banner = el('vpn-error');
  if (!banner) return;
  banner.textContent = '';
  banner.classList.remove('show');
}

function setText(id, value, fallback = 'Not available') {
  const node = el(id);
  if (!node) return;
  const str = value === null || value === undefined || value === '' ? '' : String(value);
  node.textContent = str || fallback;
}

const SIGNAL_LABELS = {
  tor: 'Tor exit node',
  vpn: 'VPN pattern',
  proxy: 'Proxy pattern',
  datacenter: 'Datacenter / hosting',
  mobile: 'Mobile network',
  residential: 'No VPN signal found',
};

function renderSignals(data) {
  const wrap = el('vpn-signals');
  if (!wrap) return;

  const checks = [
    ['Tor exit', data.isTor],
    ['VPN', data.isVpn],
    ['Proxy', data.isProxy],
    ['Datacenter', data.isDatacenter],
    ['Mobile', data.isMobile],
    ['Residential', data.isResidential],
  ];

  wrap.innerHTML = checks
    .map(([label, on]) => {
      const cls = on ? (label === 'Residential' || label === 'Mobile' ? 'on' : 'warn') : 'off';
      return `<span class="ipv-tag ${cls}">${escapeHtml(label)}: ${on ? 'yes' : 'no'}</span>`;
    })
    .join('');

  const flags = Array.isArray(data.flags) ? data.flags : [];
  const named = flags.map((f) => SIGNAL_LABELS[f] || f);
  const note = el('vpn-signals-note');
  if (note) {
    note.textContent = named.length
      ? `Matched: ${named.join(', ')}. These come from ASN, operator name and reverse-DNS patterns only.`
      : 'No pattern matched. That is not proof of anything — see the notes below.';
  }
}

function renderVerdict(data) {
  const value = el('vpn-verdict-value');
  const skeleton = el('vpn-verdict-skeleton');
  if (skeleton) skeleton.remove();
  if (!value) return;

  const level = ['low', 'medium', 'high'].includes(data.riskLevel) ? data.riskLevel : 'low';
  const label = data.riskLabel || 'Unclassified';

  value.innerHTML =
    `<span class="threat-badge ${level}">${escapeHtml(label)}</span>` +
    `<div class="tile-sub">Risk level: ${escapeHtml(level)} — a coarse summary of the signals below, not a probability.</div>`;
}

function renderEvidence(data) {
  setText('vpn-ip', data.ip);

  const ipSubParts = [];
  if (data.version) ipSubParts.push(String(data.version));
  if (data.ipType) ipSubParts.push(data.ipType);
  if (data.isBogon) ipSubParts.push('bogon / non-routable');
  setText('vpn-ip-sub', ipSubParts.join(' · '), '');

  setText('vpn-isp', data.isp);
  const ispSub = [];
  if (data.network) ispSub.push(`Network ${data.network}`);
  if (data.registry) ispSub.push(`Registry ${data.registry}`);
  setText('vpn-isp-sub', ispSub.join(' · '), 'Name as registered by the operator');

  setText('vpn-asn', data.asn);
  setText('vpn-connection', data.connection);
  setText('vpn-hostname', data.hostname, 'No PTR record');

  const place = [data.city, data.state, data.country].filter(Boolean).join(', ');
  setText('vpn-location', place, 'Unknown');
  const locSub = [];
  if (data.timezone) locSub.push(data.timezone);
  if (data.accuracy) locSub.push(data.accuracy);
  setText('vpn-location-sub', locSub.join(' · '), '');

  setText('vpn-proxychain', data.proxyDetected ? 'Forwarding chain seen' : 'None seen');
}

function renderSubject(data, isSelf) {
  const subject = el('vpn-subject');
  if (!subject) return;
  subject.textContent = isSelf ? `your connection (${data.ip || 'unknown'})` : String(data.ip || '');
}

function setBusy(busy) {
  const btn = el('vpn-check-btn');
  const me = el('vpn-me-btn');
  if (btn) btn.disabled = busy;
  if (me) me.disabled = busy;
  const value = el('vpn-verdict-value');
  if (busy && value) value.textContent = 'Checking…';
}

async function runCheck(url, isSelf) {
  clearError();
  setBusy(true);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.error) {
      const reason = data && data.error ? data.error : `request failed (HTTP ${res.status})`;
      throw new Error(reason);
    }

    lastResult = data;
    renderSubject(data, isSelf);
    renderVerdict(data);
    renderSignals(data);
    renderEvidence(data);
  } catch (err) {
    lastResult = null;
    const value = el('vpn-verdict-value');
    if (value) value.textContent = 'Check failed';
    showError(`Could not complete the check: ${err && err.message ? err.message : 'unknown error'}`);
  } finally {
    const skeleton = el('vpn-verdict-skeleton');
    if (skeleton) skeleton.remove();
    setBusy(false);
  }
}

function verdictText() {
  if (!lastResult) return '';
  const d = lastResult;
  const flags = Array.isArray(d.flags) ? d.flags.join(', ') : '';
  return [
    `IP: ${d.ip || 'unknown'}`,
    `Verdict: ${d.riskLabel || 'unclassified'} (risk ${d.riskLevel || 'unknown'})`,
    `Signals: ${flags || 'none'}`,
    `ISP: ${d.isp || 'unknown'}`,
    `ASN: ${d.asn || 'unknown'}`,
    `Connection: ${d.connection || 'unknown'}`,
    `Reverse DNS: ${d.hostname || 'none'}`,
    'Heuristic classification from public ASN, operator name and PTR data. Not definitive.',
  ].join('\n');
}

function initTools() {
  const input = el('vpn-ip-input');
  const checkBtn = el('vpn-check-btn');
  const meBtn = el('vpn-me-btn');
  const copyBtn = el('vpn-copy-btn');

  const submit = () => {
    const raw = input ? input.value.trim() : '';
    if (!raw) {
      showError('Enter an IPv4 or IPv6 address, or use "Check my own IP".');
      return;
    }
    if (!isValidIp(raw)) {
      showError(`"${raw}" does not look like a valid IPv4 or IPv6 address.`);
      return;
    }
    runCheck(`/api/lookup/${encodeURIComponent(raw)}`, false);
  };

  if (checkBtn) checkBtn.addEventListener('click', submit);
  if (input) {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submit();
      }
    });
  }

  if (meBtn) {
    meBtn.addEventListener('click', () => {
      if (input) input.value = '';
      runCheck('/api/me', true);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = verdictText();
      if (!text) {
        showError('Nothing to copy yet — run a check first.');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy verdict'; }, 1500);
      } catch (err) {
        showError('Clipboard access was refused by the browser. Select the text manually instead.');
      }
    });
  }

  runCheck('/api/me', true);
}

function initThemeToggle() {
  document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem('ipscope-theme', dark ? 'light' : 'dark'); } catch (e) {}
    }));
}

function init() {
  initThemeToggle();
  initTools();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
