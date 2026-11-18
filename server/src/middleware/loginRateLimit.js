const { createHash } = require('node:crypto');

// Single-process state. Do not enable trust proxy for arbitrary forwarded headers.
function createLoginRateLimit({ accountLimit = 5, ipLimit = 30, windowMs = 15 * 60000, maxKeys = 10000, now = Date.now } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const rawId = req.body?.userId;
    const id = typeof rawId === 'string' && /^[a-zA-Z0-9]{4,16}$/.test(rawId)
      ? createHash('sha256').update(rawId.toLowerCase()).digest('hex') : null;
    const ipKey = `ip:${ip}`;
    const accountKey = id ? `${ipKey}:${id}` : null;
    res.set('Cache-Control', 'no-store');
    const reject = seconds => {
      res.set('Retry-After', String(Math.max(1, Math.ceil(seconds))));
      return res.status(429).json({ message: '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.' });
    };
    let ipBucket = buckets.get(ipKey);
    // A blocked IP must not allocate buckets by continually rotating account names.
    if (ipBucket?.count >= ipLimit) return reject((ipBucket.expires - time) / 1000);
    if (!ipBucket) {
      if (buckets.size >= maxKeys) return reject(windowMs / 1000);
      ipBucket = { count: 0, expires: time + windowMs };
      buckets.set(ipKey, ipBucket);
    }
    // Reserve the attempt before awaiting password hashing, including concurrent requests.
    ipBucket.count++;
    let accountBucket = accountKey ? buckets.get(accountKey) : null;
    if (accountKey && !accountBucket) {
      if (buckets.size >= maxKeys) return reject(windowMs / 1000);
      accountBucket = { count: 0, expires: time + windowMs };
      buckets.set(accountKey, accountBucket);
    }
    if (accountBucket && accountBucket.count >= accountLimit) return reject((accountBucket.expires - time) / 1000);
    if (accountBucket) {
      accountBucket.count++;
      res.once('finish', () => {
        if (res.statusCode === 200 && buckets.get(accountKey) === accountBucket) buckets.delete(accountKey);
      });
    }
    next();
  };
}

module.exports = { createLoginRateLimit };
