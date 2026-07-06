const buckets = new Map();

export function rateLimit(key, max = 60, windowMs = 60_000) {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    entry = { count: 0, reset: now + windowMs };
    buckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= max;
}

export function clientKey(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return `ip:${String(cf).trim()}`;
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

export function rateLimitMiddleware({ max = 60, windowMs = 60_000, keyFn = clientKey } = {}) {
  return (req, res, next) => {
    const key = `${req.path}:${keyFn(req)}`;
    if (!rateLimit(key, max, windowMs)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    }
    next();
  };
}

export function pruneRateBuckets(maxAgeMs = 120_000) {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.reset + maxAgeMs) buckets.delete(key);
  }
}

setInterval(() => pruneRateBuckets(), 5 * 60_000).unref?.();