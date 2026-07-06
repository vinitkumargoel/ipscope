const DATACENTER_PATTERNS = /amazon|aws|google|gcp|microsoft|azure|cloudflare|digitalocean|linode|ovh|hetzner|akamai|hosting|datacenter|server|vultr|contabo|leaseweb|choopa|m247|nordvpn|expressvpn|surfshark|protonvpn|mullvad|private internet|cyberghost|ipvanish|tor exit|tor-exit/i;
const MOBILE_PATTERNS = /mobile|cellular|wireless|4g|5g|lte|vodafone|airtel|jio|t-mobile|verizon wireless/i;
const VPN_PATTERNS = /vpn|nordvpn|expressvpn|surfshark|proton|mullvad|cyberghost|ipvanish|private internet|tunnelbear|windscribe|hotspot shield/i;
const PROXY_PATTERNS = /proxy|residential proxy|bright data|luminati|oxylabs|smartproxy|squid|anonymizer/i;
const TOR_PATTERNS = /tor exit|tor-exit|torservers|exit relay/i;

export function analyzeThreat({ isp, asn, connection, proxyChain, rdapDescription, rdapName }) {
  const text = [isp, asn, rdapDescription, rdapName].filter(Boolean).join(' ');
  const lower = text.toLowerCase();

  const hasProxyChain = Array.isArray(proxyChain) && proxyChain.length > 1;
  const isTor = TOR_PATTERNS.test(lower);
  const isVpn = VPN_PATTERNS.test(lower);
  const isProxy = PROXY_PATTERNS.test(lower) || hasProxyChain;
  const isDatacenter = connection === 'Datacenter' || DATACENTER_PATTERNS.test(lower);
  const isMobile = connection === 'Mobile' || MOBILE_PATTERNS.test(lower);

  let riskLevel = 'low';
  let riskLabel = 'Residential / broadband';
  const flags = [];

  if (isTor) {
    riskLevel = 'high';
    riskLabel = 'Tor exit node';
    flags.push('tor');
  } else if (isVpn) {
    riskLevel = 'medium';
    riskLabel = 'Likely VPN';
    flags.push('vpn');
  } else if (isProxy || hasProxyChain) {
    riskLevel = 'medium';
    riskLabel = hasProxyChain ? 'Proxy chain detected' : 'Likely proxy';
    flags.push('proxy');
  } else if (isDatacenter) {
    riskLevel = 'medium';
    riskLabel = 'Datacenter / hosting';
    flags.push('datacenter');
  } else if (isMobile) {
    riskLevel = 'low';
    riskLabel = 'Mobile network';
    flags.push('mobile');
  } else {
    flags.push('residential');
  }

  return {
    riskLevel,
    riskLabel,
    isTor,
    isVpn,
    isProxy: isProxy || hasProxyChain,
    isDatacenter,
    isMobile,
    isResidential: !isTor && !isVpn && !isProxy && !isDatacenter,
    flags,
    proxyDetected: hasProxyChain,
  };
}