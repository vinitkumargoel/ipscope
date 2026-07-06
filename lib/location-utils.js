export function toDms(deg, isLat) {
  if (deg == null) return null;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = ((abs - d) * 60 - m) * 60;
  const hemi = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return `${d}°${m}'${s.toFixed(0)}" ${hemi}`;
}

export function hemisphere(lat) {
  if (lat == null) return null;
  if (lat > 0) return 'Northern Hemisphere';
  if (lat < 0) return 'Southern Hemisphere';
  return 'Equator';
}

export function mapLinks(lat, lng) {
  if (lat == null || lng == null) return null;
  return {
    openStreetMap: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`,
    googleMaps: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

export function localDate(timezone) {
  if (!timezone) return null;
  try {
    return new Date().toLocaleDateString('en-GB', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}