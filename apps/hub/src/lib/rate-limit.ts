import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://coolify-redis:6379", {
  // Suppress ioredis connection-error noise on startup
  lazyConnect: false,
  enableOfflineQueue: false,
});

redis.on("error", (err) => {
  // Log but don't crash — rate limiting is best-effort
  console.error("[rate-limit] Redis error:", err.message);
});

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();

    // results[0] is [error, value] for INCR
    const incrError = results?.[0]?.[0];
    if (incrError) throw incrError;

    const current = results?.[0]?.[1] as number;
    return { allowed: current <= limit, remaining: Math.max(0, limit - current) };
  } catch (err) {
    // Redis is down or the call failed — fail open so legitimate requests
    // aren't blocked by an infrastructure outage.
    console.error("[rate-limit] Redis call failed, failing open:", err);
    return { allowed: true, remaining: -1 };
  }
}

export function rateLimitResponse(remaining: number, windowSeconds: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(windowSeconds),
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}
