import { Router } from 'express';
import { roomManager } from '../services/room-manager.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    activeRooms: roomManager.getActiveRoomCount(),
    timestamp: Date.now(),
  });
});
