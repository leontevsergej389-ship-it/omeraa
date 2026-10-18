// CORS для случая, когда фронтенд и API живут на разных доменах.
// Авторизация идёт через заголовок Authorization (не куки), поэтому «*» не открывает CSRF.

export function cors(origins) {
  const any = origins.includes('*');
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && (any || origins.includes(origin))) {
      res.set({
        'Access-Control-Allow-Origin': any ? '*' : origin,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}
