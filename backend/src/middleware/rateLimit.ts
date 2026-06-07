import type { NextFunction, Request, Response } from "express";

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  exemptPaths?: string[];
};

type Bucket = {
  count: number;
  resetAt: number;
};

function getClientKey(req: Request): string {
  const user = (req as Request & { user?: { uid?: string } }).user;
  if (typeof user?.uid === "string" && user.uid.trim()) {
    return `uid:${user.uid.trim()}`;
  }

  return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  const exemptPaths = new Set(config.exemptPaths ?? []);
  const buckets = new Map<string, Bucket>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    if (exemptPaths.has(req.path)) {
      return next();
    }

    const now = Date.now();
    const key = getClientKey(req);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      return next();
    }

    if (bucket.count >= config.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: "Rate limit exceeded. Please try again later.",
      });
    }

    bucket.count += 1;
    next();
  };
}
