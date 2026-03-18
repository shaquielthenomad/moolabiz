import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { createSessionToken } from "@/lib/auth";

// Rate limiting: max 5 attempts per phone number per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkLoginRate(phone: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(phone);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(phone, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

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

    // Rate limit check
    if (!checkLoginRate(whatsappNumber)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait 15 minutes." },
        { status: 429 }
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
