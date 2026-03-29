import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";

const waitlistSchema = z.object({
  whatsappNumber: z.string().min(1).max(20),
  businessName: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed, remaining } = await rateLimit(`rl:waitlist:${ip}`, 10, 3600);
    if (!allowed) return rateLimitResponse(remaining, 3600);

    const body = await request.json();
    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    await db.insert(waitlist).values({
      businessName: parsed.data.businessName,
      whatsappNumber: parsed.data.whatsappNumber,
    });
    console.log(`[waitlist] ${parsed.data.businessName} — ${parsed.data.whatsappNumber}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
