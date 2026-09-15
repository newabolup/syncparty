import { Router, Request, Response, NextFunction } from 'express';
import { CreateRoomSchema, VerifyPasswordSchema } from '@syncparty/shared';
import { roomManager } from '../services/room-manager.js';
import { createRoomLimiter, verifyPasswordLimiter } from '../middleware/rate-limiter.js';

export const roomRouter = Router();

/**
 * POST /api/rooms - Create a new room
 */
roomRouter.post(
  '/',
  createRoomLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateRoomSchema.parse(req.body);
      const result = await roomManager.createRoom(parsed);

      res.status(201).json({
        success: true,
        room: result.room,
        slug: result.slug,
        hostToken: result.hostToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/rooms/:idOrSlug - Get room public metadata
 */
roomRouter.get(
  '/:idOrSlug',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idOrSlug } = req.params;
      const room = await roomManager.getOrCreateRoom(idOrSlug);

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.json({
        id: room.id,
        slug: room.slug,
        name: room.name,
        hasPassword: !!room.passwordHash,
        isHostOnlyControls: room.isHostOnlyControls,
        createdAt: room.createdAt,
        memberCount: room.members.size,
        currentVideoUrl: room.playbackState.url,
        currentVideoProvider: room.playbackState.provider,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/rooms/:idOrSlug/verify - Verify room password
 */
roomRouter.post(
  '/:idOrSlug/verify',
  verifyPasswordLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idOrSlug } = req.params;
      const room = await roomManager.getOrCreateRoom(idOrSlug);

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      if (!room.passwordHash) {
        res.json({ valid: true });
        return;
      }

      const parsed = VerifyPasswordSchema.parse(req.body);
      const isValid = await roomManager.verifyPassword(room, parsed.password);

      if (!isValid) {
        res.status(401).json({ valid: false, error: 'Incorrect password' });
        return;
      }

      res.json({ valid: true });
    } catch (err) {
      next(err);
    }
  }
);
