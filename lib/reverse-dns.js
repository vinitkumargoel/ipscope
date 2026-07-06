import { reverse } from 'node:dns/promises';
import { TtlCache } from './cache.js';

const cache = new TtlCache(5000, 3_600_000);

export async function lookupHostname(ip, timeoutMs = 2500) {
  if (!ip) return null;
  const cached = cache.get(ip);
  if (cached !== undefined) return cached;

  try {
    const names = await Promise.race([
      reverse(ip),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    const hostname = names[0] ?? null;
    cache.set(ip, hostname);
    return hostname;
  } catch {
    cache.set(ip, null);
    return null;
  }
}