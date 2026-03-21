import { NextRequest, NextResponse } from "next/server";

const GONE_MESSAGE =
  "This store has moved. Orders are now managed by the Vendure catalog. " +
  "Please use the vendure-bridge API instead.";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: GONE_MESSAGE }, { status: 410 });
}
