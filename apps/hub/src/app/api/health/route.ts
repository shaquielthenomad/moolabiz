import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import Redis from "ioredis";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://coolify-redis:6379", {
      lazyConnect: true,
      connectTimeout: 3000,
    });
    await redis.connect();
    await redis.ping();
    await redis.quit();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  return Response.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
