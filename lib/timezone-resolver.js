import { find } from 'geo-tz';

const COUNTRY_TZ = {
  IN: 'Asia/Kolkata', US: 'America/New_York', GB: 'Europe/London',
  AU: 'Australia/Sydney', JP: 'Asia/Tokyo', CN: 'Asia/Shanghai',
  DE: 'Europe/Berlin', FR: 'Europe/Paris', SG: 'Asia/Singapore',
  BR: 'America/Sao_Paulo', CA: 'America/Toronto',
};

export function resolveTimezone(dbTz, lat, lng, countryCode) {
  if (dbTz) return dbTz;
  if (lat != null && lng != null) {
    try {
      const zones = find(lat, lng);
      if (zones?.length) return zones[0];
    } catch { /* fall through */ }
  }
  if (countryCode && COUNTRY_TZ[countryCode]) return COUNTRY_TZ[countryCode];
  return null;
}

export function utcOffsetFor(tz) {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

export function localTimeFor(tz) {
  if (!tz) return null;
  try {
    return new Date().toLocaleTimeString('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch {
    return null;
  }
}