import type { Request, Response, NextFunction } from 'express';

// ponytail: fixed-window counter in a Map. Single-instance only, which matches
// the rest of the server (in-memory matches + local SQLite). Move to Redis if
// this ever runs on more than one box.
const windows = new Map<string, { count: number; resetAt: number }>();

export function hitLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // req.ip is only correct when `trust proxy` is set (it is, in index.ts)
    if (hitLimit(`${req.path}:${req.ip}`, max, windowMs)) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

// Drop stale windows so the Map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 60_000).unref();
