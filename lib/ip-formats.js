export function classifyIp(ip) {
  if (!ip) return { ipType: 'Unknown', isBogon: false, isGlobal: false };

  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    if (l === '::1') return { ipType: 'Loopback', isBogon: true, isGlobal: false };
    if (l.startsWith('fe80:')) return { ipType: 'Link-local', isBogon: true, isGlobal: false };
    if (l.startsWith('fc') || l.startsWith('fd')) return { ipType: 'Unique local', isBogon: true, isGlobal: false };
    if (l.startsWith('ff')) return { ipType: 'Multicast', isBogon: true, isGlobal: false };
    return { ipType: 'Global unicast', isBogon: false, isGlobal: true };
  }

  const [a, b, c, d] = ip.split('.').map(Number);
  if (a === 127) return { ipType: 'Loopback', isBogon: true, isGlobal: false };
  if (a === 10) return { ipType: 'Private (RFC1918)', isBogon: true, isGlobal: false };
  if (a === 172 && b >= 16 && b <= 31) return { ipType: 'Private (RFC1918)', isBogon: true, isGlobal: false };
  if (a === 192 && b === 168) return { ipType: 'Private (RFC1918)', isBogon: true, isGlobal: false };
  if (a === 169 && b === 254) return { ipType: 'Link-local', isBogon: true, isGlobal: false };
  if (a >= 224 && a <= 239) return { ipType: 'Multicast', isBogon: true, isGlobal: false };
  if (a >= 240) return { ipType: 'Reserved', isBogon: true, isGlobal: false };
  if (a === 0) return { ipType: 'Reserved', isBogon: true, isGlobal: false };
  return { ipType: 'Global unicast', isBogon: false, isGlobal: true };
}

export function ipFormats(ip) {
  if (!ip || ip.includes(':')) {
    return { ipDecimal: null, ipHex: null, ipBinary: null };
  }
  const parts = ip.split('.').map(Number);
  const decimal = parts.reduce((acc, p) => (acc << 8) + p, 0) >>> 0;
  const hex = '0x' + decimal.toString(16).toUpperCase().padStart(8, '0');
  const binary = parts.map((p) => p.toString(2).padStart(8, '0')).join('.');
  return { ipDecimal: decimal, ipHex: hex, ipBinary: binary };
}