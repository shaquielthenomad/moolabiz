import { NextRequest } from "next/server";

const API_SECRET = process.env.API_SECRET || "";

export function isAuthorized(request: NextRequest | Request): boolean {
  const auth = request.headers.get("authorization") || "";
  return API_SECRET.length > 0 && auth === `Bearer ${API_SECRET}`;
}
