import { NextRequest, NextResponse } from "next/server";

const SLUG = process.env.BUSINESS_SLUG || "";

/**
 * Proxies requests to the internal OpenClaw web UI.
 * The OpenClaw container is NOT exposed to the internet —
 * this proxy is the only way to access it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!SLUG) {
    return new NextResponse("Not configured", { status: 500 });
  }

  const { path } = await params;
  const proxyPath = "/" + (path?.join("/") || "");
  const openclawUrl = `http://openclaw-${SLUG}:18789${proxyPath}`;

  try {
    const res = await fetch(openclawUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: request.headers.get("accept") || "*/*",
      },
    });

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": contentType,
        "cache-control": contentType.includes("text/html")
          ? "no-cache"
          : "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("OpenClaw gateway not ready yet. Please wait...", { status: 502 });
  }
}
