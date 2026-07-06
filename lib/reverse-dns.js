import { reverse } from 'node:dns/promises';

export async function lookupHostname(ip, timeoutMs = 2500) {
  try {
    const names = await Promise.race([
      reverse(ip),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return names[0] ?? null;
  } catch {
    return null;
  }
}