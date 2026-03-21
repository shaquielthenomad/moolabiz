import { NextRequest, NextResponse } from 'next/server';

/**
 * Shared storefront middleware.
 *
 * Resolves the merchant from the request subdomain:
 *   {slug}.store.moolabiz.shop  ->  slug
 *
 * Looks up the Vendure channel token for that slug by querying the
 * Vendure Admin API for a channel whose code matches the slug.
 * The token is then forwarded to the app via request headers so that
 * the Vendure Shop API client can scope every request to the correct channel.
 */

// ---------------------------------------------------------------------------
// In-memory cache: slug -> { token, businessName, expiresAt }
// ---------------------------------------------------------------------------
interface CacheEntry {
  token: string;
  businessName: string;
  expiresAt: number;
}

const channelCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Slug extraction
// ---------------------------------------------------------------------------

/**
 * Extract the merchant slug from the hostname.
 * Expected pattern: {slug}.store.moolabiz.shop
 * For local dev: {slug}.localhost or {slug}.local.moolabiz.shop
 */
function extractSlug(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Production: {slug}.store.moolabiz.shop
  const prodMatch = host.match(/^([a-z0-9-]+)\.store\.moolabiz\.shop$/);
  if (prodMatch) return prodMatch[1];

  // Dev: {slug}.localhost
  const devMatch = host.match(/^([a-z0-9-]+)\.localhost$/);
  if (devMatch) return devMatch[1];

  // Dev alternative: {slug}.local.moolabiz.shop
  const devAltMatch = host.match(/^([a-z0-9-]+)\.local\.moolabiz\.shop$/);
  if (devAltMatch) return devAltMatch[1];

  return null;
}

// ---------------------------------------------------------------------------
// Channel token resolution — queries Vendure Admin API
// ---------------------------------------------------------------------------

const VENDURE_ADMIN_API_URL =
  process.env.VENDURE_ADMIN_API_URL || 'http://localhost:3100/admin-api';
const VENDURE_ADMIN_AUTH_TOKEN = process.env.VENDURE_ADMIN_AUTH_TOKEN || '';

const CHANNELS_QUERY = `
  query GetChannelByCode($code: String!) {
    channels(options: { filter: { code: { eq: $code } }, take: 1 }) {
      items {
        id
        code
        token
      }
    }
  }
`;

// Hub API fallback — also returns businessName
const HUB_API_URL = process.env.HUB_API_URL || 'https://moolabiz.shop';

async function resolveChannel(
  slug: string
): Promise<{ token: string; businessName: string } | null> {
  // Check cache first
  const cached = channelCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return { token: cached.token, businessName: cached.businessName };
  }

  // Strategy 1: Query Vendure Admin API for the channel
  try {
    const res = await fetch(VENDURE_ADMIN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VENDURE_ADMIN_AUTH_TOKEN
          ? { Authorization: `Bearer ${VENDURE_ADMIN_AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        query: CHANNELS_QUERY,
        variables: { code: slug },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const channel = json?.data?.channels?.items?.[0];
      if (channel?.token) {
        // We have the token from Vendure but not the businessName.
        // Try hub API for the businessName; fall back to the slug.
        let businessName = slug;
        try {
          const hubRes = await fetch(
            `${HUB_API_URL}/api/channel-token?slug=${encodeURIComponent(slug)}`
          );
          if (hubRes.ok) {
            const hubData = await hubRes.json();
            businessName = hubData.businessName || slug;
          }
        } catch {
          // Hub unreachable — use slug as name
        }

        const entry: CacheEntry = {
          token: channel.token,
          businessName,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        channelCache.set(slug, entry);
        return { token: entry.token, businessName: entry.businessName };
      }
    }
  } catch {
    // Vendure unreachable, try hub API as fallback
  }

  // Strategy 2: Hub API fallback
  try {
    const hubRes = await fetch(
      `${HUB_API_URL}/api/channel-token?slug=${encodeURIComponent(slug)}`
    );
    if (hubRes.ok) {
      const hubData = await hubRes.json();
      if (hubData.channelToken) {
        const entry: CacheEntry = {
          token: hubData.channelToken,
          businessName: hubData.businessName || slug,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        channelCache.set(slug, entry);
        return { token: entry.token, businessName: entry.businessName };
      }
    }
  } catch {
    // Hub also unreachable
  }

  return null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const slug = extractSlug(hostname);

  // No subdomain — could be the bare domain or an unrecognised host.
  // Let the request through with defaults (env-based channel token).
  if (!slug) {
    return NextResponse.next();
  }

  const channel = await resolveChannel(slug);

  if (!channel) {
    // Unknown merchant — return 404
    return new NextResponse(
      '<html><body><h1>Store not found</h1><p>The store you are looking for does not exist.</p></body></html>',
      {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }

  // Forward channel info via request headers so server components can read them
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-vendure-channel-token', channel.token);
  requestHeaders.set('x-store-slug', slug);
  requestHeaders.set('x-store-name', channel.businessName);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Run on all routes except static files and Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
