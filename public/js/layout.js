export const FOOTER_LINKS = {
  product: [
    { href: '/', label: 'What is my IP?' },
    { href: '/tools/bulk-lookup', label: 'Bulk lookup' },
    { href: '/api-docs', label: 'API docs' },
    { href: '/faq', label: 'FAQ' },
  ],
  legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
    { href: '/cookies', label: 'Cookie Policy' },
    { href: '/dmca', label: 'DMCA' },
    { href: '/comment-policy', label: 'Comment Policy' },
    { href: '/disclaimer', label: 'Disclaimer' },
  ],
  company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
};

export function renderSiteFooter() {
  const year = new Date().getFullYear();
  const cols = (title, links) => `
    <div class="footer-col">
      <h4>${title}</h4>
      <ul>${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}</ul>
    </div>`;

  return `
    <footer class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-brand">
          <a class="logo" href="/">IP<span>Scope</span></a>
          <p>Self-hosted IP geolocation with offline MMDB databases. No third-party API keys. IPv4 and IPv6 supported.</p>
        </div>
        <div class="footer-cols">
          ${cols('Product', FOOTER_LINKS.product)}
          ${cols('Legal', FOOTER_LINKS.legal)}
          ${cols('Company', FOOTER_LINKS.company)}
        </div>
      </div>
      <div class="site-footer-bottom">
        <span>&copy; ${year} IPScope. Location data is approximate — city level, not your exact address.</span>
        <span class="footer-badges">
          <span>Offline MMDB</span>
          <span>IPv4 + IPv6</span>
          <span>No API keys</span>
        </span>
      </div>
    </footer>`;
}

export function initCookieConsent() {
  if (localStorage.getItem('ipscope-cookie-consent')) return;

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <p>We use essential cookies and local storage for recent lookups and theme preference. See our <a href="/cookies">Cookie Policy</a>.</p>
    <button type="button" id="cookie-accept">Accept</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('#cookie-accept').addEventListener('click', () => {
    localStorage.setItem('ipscope-cookie-consent', '1');
    banner.remove();
  });
}

export function initTheme() {
  const saved = localStorage.getItem('ipscope-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('ipscope-theme', isDark ? 'light' : 'dark');
}