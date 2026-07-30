import { initCookieConsent, initThemeToggles } from '../layout.js';
import { exportCsv, exportJson } from '../features.js';

const MAX_IPS = 100;

const SAMPLE = [
  '8.8.8.8',
  '1.1.1.1',
  '9.9.9.9',
  '208.67.222.222',
  '2001:4860:4860::8888',
  '2606:4700:4700::1111',
].join('\n');

const $ = (id) => document.getElementById(id);

function init() {
  initCookieConsent();
  initThemeToggles();

  const input = $('bulk-input');
  const error = $('bulk-error');
  const results = $('bulk-results');
  const rows = $('bulk-rows');
  const countEl = $('bulk-count');
  const counter = $('bulk-counter');
  const submit = $('bulk-submit');

  if (!input || !submit) return;

  let lastResults = [];

  const showError = (msg) => {
    error.textContent = msg;
    error.classList.add('show');
  };
  const hideError = () => error.classList.remove('show');

  const parseIps = () =>
    input.value
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const updateCounter = () => {
    const n = parseIps().length;
    if (!n) {
      counter.textContent = '';
    } else if (n > MAX_IPS) {
      counter.textContent = `${n} addresses — ${n - MAX_IPS} over the limit of ${MAX_IPS}`;
    } else {
      counter.textContent = `${n} address${n === 1 ? '' : 'es'}`;
    }
  };

  input.addEventListener('input', updateCounter);

  $('bulk-sample')?.addEventListener('click', () => {
    input.value = SAMPLE;
    updateCounter();
    hideError();
  });

  $('bulk-clear')?.addEventListener('click', () => {
    input.value = '';
    results.style.display = 'none';
    rows.replaceChildren();
    lastResults = [];
    updateCounter();
    hideError();
  });

  $('bulk-export-csv')?.addEventListener('click', () => {
    if (lastResults.length) exportCsv(lastResults);
  });

  $('bulk-export-json')?.addEventListener('click', () => {
    if (lastResults.length) exportJson({ count: lastResults.length, results: lastResults }, 'ipscope-bulk');
  });

  function renderRow(r) {
    const row = document.createElement('div');
    row.className = 'bulk-row';
    const ipCell = document.createElement('span');

    if (r.error) {
      ipCell.textContent = r.ip;
      const errCell = document.createElement('span');
      errCell.className = 'bulk-error-cell';
      errCell.textContent = r.error;
      const dash = document.createElement('span');
      dash.textContent = '—';
      row.append(ipCell, errCell, dash);
      return row;
    }

    const link = document.createElement('a');
    link.href = `/lookup/${encodeURIComponent(r.ip)}`;
    link.textContent = r.ip;
    ipCell.append(link);

    const locCell = document.createElement('span');
    locCell.textContent = [r.city, r.state, r.country].filter(Boolean).join(', ') || 'Unknown';

    const ispCell = document.createElement('span');
    const parts = [r.isp, r.asn].filter(Boolean);
    ispCell.textContent = parts.join(' · ') || '—';

    row.append(ipCell, locCell, ispCell);
    return row;
  }

  submit.addEventListener('click', async () => {
    hideError();
    const ips = parseIps();

    if (!ips.length) return showError('Enter at least one IP address.');
    if (ips.length > MAX_IPS) {
      return showError(
        `Maximum ${MAX_IPS} addresses per run — you pasted ${ips.length}. Deduplicate the list, or use the API to process it in batches.`,
      );
    }

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Looking up…';

    try {
      const res = await fetch('/api/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server returned ${res.status} with an unreadable body.`);
      }
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

      lastResults = Array.isArray(data.results) ? data.results : [];
      const failed = lastResults.filter((r) => r.error).length;

      countEl.textContent =
        `${lastResults.length} result${lastResults.length === 1 ? '' : 's'}` +
        (failed ? ` · ${failed} could not be resolved` : '');

      rows.replaceChildren(...lastResults.map(renderRow));
      results.style.display = 'block';

      if (lastResults.length !== ips.length) {
        showError(`Sent ${ips.length} addresses but received ${lastResults.length} results.`);
      }
    } catch (err) {
      showError(err.message || 'Bulk lookup failed.');
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });

  updateCounter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
