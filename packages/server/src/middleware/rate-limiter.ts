import rateLimit from 'express-rate-limit';

export const createRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 room creations per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many rooms created from this IP, please try again after 15 minutes.',
  },
});

export const verifyPasswordLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 password attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password attempts, please wait a minute.',
  },
});
