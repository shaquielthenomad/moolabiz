import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { createSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { whatsappNumber, pin } = await request.json();

    if (
      !whatsappNumber ||
      typeof whatsappNumber !== "string" ||
      !pin ||
      typeof pin !== "string"
    ) {
      return NextResponse.json(
        { error: "Please enter your number and PIN." },
        { status: 400 }
      );
    }

    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.whatsappNumber, whatsappNumber))
      .limit(1);

    if (!merchant || !merchant.pin) {
      return NextResponse.json(
        { error: "Wrong number or PIN. Try again." },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(pin, merchant.pin);
    if (!valid) {
      return NextResponse.json(
        { error: "Wrong number or PIN. Try again." },
        { status: 401 }
      );
    }

    const token = createSessionToken(merchant.id);
    const res = NextResponse.json({ success: true });
    res.cookies.set("moolabiz_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 }
    );
  }
}
