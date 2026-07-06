function vcardEmail(vcardArray) {
  if (!vcardArray?.[1]) return null;
  for (const entry of vcardArray[1]) {
    if (entry[0] === 'email' && entry[3]) return entry[3];
  }
  return null;
}

function entityByRole(entities, role) {
  for (const e of entities || []) {
    const roles = e.roles ?? (e.role ? [e.role] : []);
    if (roles.includes(role)) return e;
  }
  return null;
}

function parseRegistry(notices) {
  for (const n of notices || []) {
    if (n.title === 'Source' && n.description?.[1]) {
      return n.description[1];
    }
  }
  return null;
}

function parseDescription(remarks) {
  for (const r of remarks || []) {
    if (r.title === 'description' && r.description?.[0]) {
      return r.description[0];
    }
  }
  return null;
}

export async function lookupRdap(ip, timeoutMs = 4000) {
  if (!ip || ip.includes(':')) return null;

  try {
    const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const abuse = entityByRole(data.entities, 'abuse');
    const admin = entityByRole(data.entities, 'administrative');
    const tech = entityByRole(data.entities, 'technical');
    const registrant = entityByRole(data.entities, 'registrant');

    const regEvent = data.events?.find((e) => e.eventAction === 'registration');
    const changedEvent = data.events?.find((e) =>
      e.eventAction === 'last changed' || e.eventAction === 'last changed in RDAP',
    );

    const cidr = data.cidr0_cidrs?.[0];
    const cidrStr = cidr ? `${cidr.v4prefix ?? cidr.v6prefix}/${cidr.length}` : null;

    return {
      registry: parseRegistry(data.notices),
      rdapName: data.name ?? null,
      rdapHandle: data.handle ?? null,
      rdapType: data.type ?? null,
      rdapStatus: data.status?.join(', ') ?? null,
      rdapCountry: data.country ?? null,
      rdapDescription: parseDescription(data.remarks),
      rdapRange: data.startAddress && data.endAddress
        ? `${data.startAddress} – ${data.endAddress}`
        : null,
      rdapCidr: cidrStr,
      rdapRegistered: regEvent?.eventDate?.slice(0, 10) ?? null,
      rdapUpdated: changedEvent?.eventDate?.slice(0, 10) ?? null,
      whoisServer: data.port43 ?? null,
      abuseEmail: vcardEmail(abuse?.vcardArray) ?? null,
      techEmail: vcardEmail(tech?.vcardArray) ?? vcardEmail(admin?.vcardArray) ?? null,
      registrant: registrant?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] ?? null,
      parentHandle: data.parentHandle ?? null,
    };
  } catch {
    return null;
  }
}