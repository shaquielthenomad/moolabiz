import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/channel-token?slug=X
 *
 * Public, read-only endpoint that returns the Vendure channel token and
 * business name for a given merchant slug.
 *
 * Channel tokens scope data access — they do not grant write permissions —
 * so exposing them is safe.
 *
 * Response is cached for 5 minutes.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "Missing 'slug' query parameter" },
      { status: 400 }
    );
  }

  try {
    const [merchant] = await db
      .select({
        businessName: merchants.businessName,
        vendureChannelToken: merchants.vendureChannelToken,
        status: merchants.status,
      })
      .from(merchants)
      .where(eq(merchants.slug, slug))
      .limit(1);

    if (!merchant || !merchant.vendureChannelToken) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    if (merchant.status !== "active") {
      return NextResponse.json(
        { error: "Store is not active" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        channelToken: merchant.vendureChannelToken,
        businessName: merchant.businessName,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (err) {
    console.error("[channel-token GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
