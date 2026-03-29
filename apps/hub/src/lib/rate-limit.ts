import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://coolify-redis:6379");

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSeconds);
  return { allowed: current <= limit, remaining: Math.max(0, limit - current) };
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
