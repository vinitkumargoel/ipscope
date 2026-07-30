/**
 * Client-side chrome. The site footer and its link graph are rendered on the
 * server (lib/render.js) so they exist in HTML for crawlers — this file only
 * handles behaviour that genuinely needs the browser.
 *
 * The initial theme is applied pre-paint by /js/theme-init.js, so there is no
 * initTheme() here; only the toggle lives on this side.
 */

export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('ipscope-theme', next);
  } catch {
    /* storage blocked — the toggle still works for this page view */
  }
}

export function initCookieConsent() {
  let consented = true;
  try {
    consented = Boolean(localStorage.getItem('ipscope-cookie-consent'));
  } catch {
    // Storage blocked: we cannot record consent, so do not nag on every load.
    return;
  }
  if (consented) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <p>We use essential local storage for recent lookups and your theme preference. See our <a href="/cookies">Cookie Policy</a>.</p>
    <button type="button" id="cookie-accept">Accept</button>
  `;
  document.body.appendChild(banner);

  banner.querySelector('#cookie-accept').addEventListener('click', () => {
    try {
      localStorage.setItem('ipscope-cookie-consent', '1');
    } catch {
      /* ignore — dismissing still hides it for this view */
    }
    banner.remove();
  });
}

export function initThemeToggles(root = document) {
  root.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
}
