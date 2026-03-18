import { NextResponse } from "next/server";
import db from "@/lib/db";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";

export async function GET() {
  // Check SQLite
  let dbOk = false;
  try {
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  // Check Ollama sidecar
  const ollamaOk = await fetch(`${OLLAMA_URL}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  })
    .then(() => true)
    .catch(() => false);

  const status = dbOk ? (ollamaOk ? "ok" : "degraded") : "error";

  return NextResponse.json(
    { status, db: dbOk, ollama: ollamaOk },
    { status: dbOk ? 200 : 503 },
  );
}
