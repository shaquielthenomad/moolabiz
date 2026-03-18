import { NextResponse } from "next/server";
import db from "@/lib/db";

// Settings stored in SQLite for the merchant
// Called by OpenClaw/n8n when merchant sends commands like /set-payment-key

function checkAuth(request: Request): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create settings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

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
  if (!checkAuth(request)) {
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(key, value);

  return NextResponse.json({ success: true, key });
}
