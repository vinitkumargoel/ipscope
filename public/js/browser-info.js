export function getBrowserInfo() {
  const ua = navigator.userAgent;
  const lang = navigator.language || navigator.languages?.[0] || '—';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screen = `${window.screen.width}×${window.screen.height}`;
  const dpr = window.devicePixelRatio ? `${window.devicePixelRatio}x` : '1x';
  const cores = navigator.hardwareConcurrency ?? '—';
  const touch = navigator.maxTouchPoints ?? 0;
  const online = navigator.onLine;
  const cookies = navigator.cookieEnabled;
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const colorScheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light';
  const platform = navigator.platform || '—';
  const secure = location.protocol === 'https:';

  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  const device = /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop';

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let networkType = null;
  let downlink = null;
  if (conn) {
    networkType = conn.effectiveType?.toUpperCase() ?? null;
    downlink = conn.downlink != null ? `${conn.downlink} Mbps` : null;
  }

  return {
    browser, os, device, language: lang, browserTimezone: tz, screen, pixelRatio: dpr,
    cores, touchPoints: touch, online, cookies, doNotTrack: dnt, colorScheme, platform,
    secure, networkType, downlink,
  };
}