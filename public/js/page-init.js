import { initCookieConsent, initThemeToggles } from './layout.js';

// Content pages need nothing but the cookie notice and the theme toggle. The
// footer, breadcrumbs and metadata are all rendered server-side, and the initial
// theme is applied pre-paint by /js/theme-init.js.
function init() {
  initCookieConsent();
  initThemeToggles();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
