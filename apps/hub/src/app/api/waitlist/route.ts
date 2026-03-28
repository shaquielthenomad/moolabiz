import { NextResponse } from "next/server";
import { z } from "zod";

const waitlistSchema = z.object({
  whatsappNumber: z.string().min(1).max(20),
  businessName: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.log(`[waitlist] ${parsed.data.businessName} — ${parsed.data.whatsappNumber}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
