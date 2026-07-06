/**
 * Discover public IPv4/IPv6 via WebRTC ICE (STUN).
 * Used when the server only sees localhost/private (e.g. ::1).
 * No geolocation API — only reveals your NAT public address.
 */
export function discoverPublicIps(timeoutMs = 2500) {
  if (!window.RTCPeerConnection) {
    return Promise.resolve({ ipv4: null, ipv6: null, localIps: [] });
  }

  return new Promise((resolve) => {
    const found = { ipv4: null, ipv6: null, localIps: [] };
    const seen = new Set();

    const finish = () => {
      pc.close();
      resolve(found);
    };

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.createDataChannel('ipscope');
    pc.onicecandidate = (event) => {
      if (!event.candidate?.candidate) return;

      const parts = event.candidate.candidate.split(' ');
      const addr = parts[4];
      const typ = parts[parts.indexOf('typ') + 1];

      if (!addr || seen.has(addr)) return;
      seen.add(addr);

      // srflx = server reflexive (your public IP through NAT)
      // host on global IPv6 can also be useful
      const isV6 = addr.includes(':');
      const isPrivate =
        addr.startsWith('10.') ||
        addr.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(addr) ||
        addr === '127.0.0.1' ||
        addr.startsWith('fe80:') ||
        addr === '::1' ||
        addr.startsWith('fc') ||
        addr.startsWith('fd');

      if (isPrivate) {
        if (typ === 'host' && !found.localIps.includes(addr)) {
          found.localIps.push(addr);
        }
        return;
      }

      if (typ === 'srflx' || typ === 'relay') {
        if (isV6 && !found.ipv6) found.ipv6 = addr;
        else if (!isV6 && !found.ipv4) found.ipv4 = addr;
      } else if (typ === 'host' && isV6 && !found.ipv6) {
        found.ipv6 = addr;
      }

      if (found.ipv4 && found.ipv6) finish();
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());

    setTimeout(finish, timeoutMs);
  });
}