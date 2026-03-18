import { NextResponse } from "next/server";
import db from "@/lib/db";
import { isAuthorized } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Settings table created at init in db.ts
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    // Mask sensitive values
    if (row.key.includes("secret") || row.key.includes("key")) {
      settings[row.key] = row.value.slice(0, 8) + "..." + row.value.slice(-4);
    } else {
      settings[row.key] = row.value;
    }
  }

  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  if (!key || !value) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }

  // Only allow known settings
  const allowedKeys = [
    "yoco_secret_key",
    "ozow_site_code",
    "ozow_private_key",
    "payfast_merchant_id",
    "payfast_merchant_key",
    "payment_provider",
    "business_hours",
    "delivery_info",
    "welcome_message",
  ];

  if (!allowedKeys.includes(key)) {
    return NextResponse.json(
      { error: `Unknown setting. Allowed: ${allowedKeys.join(", ")}` },
      { status: 400 }
    );
  }

  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(key, value);

  return NextResponse.json({ success: true, key });
}
