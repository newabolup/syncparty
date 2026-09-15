import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { healthRouter } from './routes/health-routes.js';
import { roomRouter } from './routes/room-routes.js';
import { errorHandler } from './middleware/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Let reverse-proxy / client define CSP for video frames
    })
  );

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );

  // Body parsers
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/health', healthRouter);
  app.use('/api/rooms', roomRouter);

  // Serve production client build if present
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Central error handler
  app.use(errorHandler);

  return app;
}

