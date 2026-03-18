import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";

export async function GET() {
  const ollamaOk = await fetch(`${OLLAMA_URL}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  })
    .then(() => true)
    .catch(() => false);

  const status = ollamaOk ? "ok" : "degraded";

  return NextResponse.json(
    { status, ollama: ollamaOk },
    { status: ollamaOk ? 200 : 503 },
  );
}
