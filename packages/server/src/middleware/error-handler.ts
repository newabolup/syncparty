import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError || (err as any)?.name === 'ZodError') {
    const formatDetails = typeof (err as any).format === 'function' ? (err as any).format() : (err as any).issues;
    res.status(400).json({
      error: 'Validation failed',
      details: formatDetails,
    });
    return;
  }

  const errorMessage = err instanceof Error ? err.message : 'Internal Server Error';
  console.error('[API Error]:', err);

  res.status(500).json({
    error: errorMessage,
  });
}
