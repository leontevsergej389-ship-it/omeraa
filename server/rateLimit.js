// Минимальный ограничитель частоты запросов в памяти процесса.

export function rateLimit({ windowMs, max, message, key = (req) => req.ip }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.reset < now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(k, entry);
    }
    if (++entry.count > max) return res.status(429).json({ error: message });
    next();
  };
}
