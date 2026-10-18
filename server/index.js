// Точка входа сервера: Express (REST) + Socket.io (реалтайм) + раздача собранного фронтенда.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { createAdminRouter } from './admin.js';
import { createRealtime } from './realtime.js';
import { createApiRouter } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

const httpServer = http.createServer(app);
const realtime = createRealtime(httpServer);

app.use('/api/admin', createAdminRouter(realtime));
app.use('/api', createApiRouter(realtime));
app.use('/api', (req, res) => res.status(404).json({ error: 'Метод не найден' }));

// В продакшене сервер сам отдаёт собранный фронтенд (npm run build && npm start).
if (fs.existsSync(path.join(config.distDir, 'index.html'))) {
  app.use(express.static(config.distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(config.distDir, 'index.html'));
  });
}

app.use((err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  console.error('[http]', err);
  res.status(500).json({ error: 'Ошибка сервера' });
});

httpServer.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}  ·  база: ${config.dbFile}`);
  console.log(`[server] авто-админы: ${config.adminUsernames.join(', ') || '—'}`);
});
