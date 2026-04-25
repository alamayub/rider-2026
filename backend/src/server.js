import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initDb } from './db/store.js';
import { createSocketServer } from './realtime/socket.js';
import { logger } from './utils/logger.js';

await initDb();

const app = createApp();
const server = http.createServer(app);
createSocketServer(server, env.corsOrigin);

server.listen(env.port, () => {
  logger.info('server_started', { port: env.port, env: env.nodeEnv, dbClient: env.dbClient });
});
