import http from 'http';
import { createApp } from './app.js';
import { setupSocketServer } from './socket/index.js';
import { config } from './config.js';
import { disconnectPrisma } from './db/prisma.js';

const app = createApp();
const server = http.createServer(app);

// Attach Socket.IO
const io = setupSocketServer(server);

server.listen(config.PORT, () => {
  console.log(`[SyncParty Server] running on http://localhost:${config.PORT} (${config.NODE_ENV})`);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Closing server gracefully...`);

  server.close(() => {
    console.log('HTTP & Socket server closed.');
  });

  io.close(() => {
    console.log('Socket.IO connections closed.');
  });

  await disconnectPrisma();
  console.log('Database disconnected.');

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
