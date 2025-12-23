import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";

interface Options {
  windowSec?: number; // window in seconds
  max?: number; // max requests per window
  keyPrefix?: string;
}

const defaultOptions: Options = {
  windowSec: 60,
  max: 100,
  keyPrefix: "rl:",
};

export default function redisRateLimiter(opts?: Options) {
  const options = { ...defaultOptions, ...(opts || {}) };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const key = `${options.keyPrefix}${ip}`;

      const current = await redisClient.incr(key);
      if (current === 1) {
        // first request in window: set expiry
        await redisClient.expire(key, options.windowSec!);
      }

      if (current > (options.max || 0)) {
        const ttl = await redisClient.ttl(key);
        res.setHeader("Retry-After", String(ttl ?? options.windowSec));
        return res.status(429).json({
          statusCode: 429,
          message: `Too many requests. Try again in ${ttl} seconds`,
        });
      }

      next();
    } catch (err) {
      // If Redis unavailable, don't block traffic — allow through
      // but log for visibility
      // eslint-disable-next-line no-console
      console.warn("Redis rate limiter error, skipping limiter:", err);
      next();
    }
  };
}
