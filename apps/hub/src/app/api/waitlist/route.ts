import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { whatsappNumber, businessName } = await request.json();
    // Log waitlist signups — in future, store in DB
    console.log(`[waitlist] ${businessName} — ${whatsappNumber}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // Always succeed for UX
  }
}
