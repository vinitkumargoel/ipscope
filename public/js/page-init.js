import { renderSiteFooter, initCookieConsent, initTheme, toggleTheme } from './layout.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCookieConsent();

  const footerMount = document.getElementById('site-footer-mount');
  if (footerMount) footerMount.innerHTML = renderSiteFooter();

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
});