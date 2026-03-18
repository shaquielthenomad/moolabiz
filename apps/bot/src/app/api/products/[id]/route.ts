import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const API_SECRET = process.env.API_SECRET || "";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  return API_SECRET.length > 0 && auth === `Bearer ${API_SECRET}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(id));

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(id));
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["name", "description", "price", "image_url", "category", "in_stock"];
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = ?`);
      values.push(body[key]);
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  sets.push("updated_at = datetime('now')");
  values.push(Number(id));

  db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(id));
  return NextResponse.json({ product: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(Number(id));

  if (result.changes === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
