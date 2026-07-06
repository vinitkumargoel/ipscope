import * as SunCalc from 'suncalc';

export function sunInfo(lat, lng, timezone) {
  if (lat == null || lng == null) return null;

  const now = new Date();
  const times = SunCalc.getTimes(now, lat, lng);
  const isDay = now >= times.sunrise && now < times.sunset;

  const fmt = (d) => d.toLocaleTimeString('en-GB', {
    timeZone: timezone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    isDaytime: isDay,
    dayNight: isDay ? 'Daytime' : 'Nighttime',
    sunrise: fmt(times.sunrise),
    sunset: fmt(times.sunset),
    solarNoon: fmt(times.solarNoon),
  };
}