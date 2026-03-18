import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { isAuthorized } from "@/lib/auth";

export async function GET() {
  const products = db.prepare(
    "SELECT * FROM products WHERE in_stock = 1 ORDER BY category, name"
  ).all();

  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; description?: string; price?: number; image_url?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, price, image_url, category } = body;

  if (!name || typeof price !== "number" || price < 0) {
    return NextResponse.json(
      { error: "name (string) and price (number, cents) are required" },
      { status: 400 }
    );
  }

  const result = db.prepare(
    "INSERT INTO products (name, description, price, image_url, category) VALUES (?, ?, ?, ?, ?)"
  ).run(name, description || "", price, image_url || "", category || "General");

  return NextResponse.json(
    { id: result.lastInsertRowid, name, price },
    { status: 201 }
  );
}
