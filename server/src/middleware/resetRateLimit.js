// Single-process IP limit; persistent per-account send cooldown lives in PasswordReset.
// Do not trust X-Forwarded-For unless the deployment explicitly configures trust proxy.
const createResetRateLimit = ({ limit = 10, windowMs = 15 * 60000, maxKeys = 10000, now = Date.now } = {}) => {
    const requests = new Map();
    return (req, res, next) => {
        const time = now();
        for (const [key, entry] of requests) {
            if (entry.expiresAt <= time) requests.delete(key);
        }
        const key = req.ip || req.socket?.remoteAddress || 'unknown';
        let entry = requests.get(key);
        if (!entry) {
            if (requests.size >= maxKeys) {
                res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
                return res.status(429).json({ message: '요청이 많습니다. 잠시 후 다시 시도해주세요.' });
            }
            entry = { count: 0, expiresAt: time + windowMs };
            requests.set(key, entry);
        }
        entry.count++;
        if (entry.count > limit) {
            res.set('Retry-After', String(Math.ceil((entry.expiresAt - time) / 1000)));
            return res.status(429).json({ message: '요청이 많습니다. 잠시 후 다시 시도해주세요.' });
        }
        next();
    };
};

module.exports = { createResetRateLimit };
