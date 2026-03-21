import type {TadaDocumentNode} from 'gql.tada';
import {print} from 'graphql';
import {headers as getHeaders} from 'next/headers';
import {getAuthToken} from '@/lib/auth';

const VENDURE_API_URL = process.env.VENDURE_SHOP_API_URL || process.env.NEXT_PUBLIC_VENDURE_SHOP_API_URL;
const VENDURE_CHANNEL_TOKEN_FALLBACK = process.env.VENDURE_CHANNEL_TOKEN || process.env.NEXT_PUBLIC_VENDURE_CHANNEL_TOKEN || '__default_channel__';
const VENDURE_AUTH_TOKEN_HEADER = process.env.VENDURE_AUTH_TOKEN_HEADER || 'vendure-auth-token';
const VENDURE_CHANNEL_TOKEN_HEADER = process.env.VENDURE_CHANNEL_TOKEN_HEADER || 'vendure-token';

// Validated lazily at request time — not at import/build time
function getApiUrl(): string {
    if (!VENDURE_API_URL) {
        throw new Error('VENDURE_SHOP_API_URL or NEXT_PUBLIC_VENDURE_SHOP_API_URL environment variable is not set');
    }
    return VENDURE_API_URL;
}

/**
 * Read the Vendure channel token dynamically.
 *
 * In production the middleware resolves the merchant from the subdomain and
 * forwards the token via the `x-vendure-channel-token` request header.
 * Falls back to the env-var value for local development without subdomains.
 */
async function getChannelToken(): Promise<string> {
    try {
        const hdrs = await getHeaders();
        const dynamicToken = hdrs.get('x-vendure-channel-token');
        if (dynamicToken) return dynamicToken;
    } catch {
        // headers() unavailable outside of a request context (e.g. build time)
    }
    return VENDURE_CHANNEL_TOKEN_FALLBACK;
}

/**
 * Read the current store's display name (set by middleware).
 * Returns null when running without subdomain resolution.
 */
export async function getStoreName(): Promise<string | null> {
    try {
        const hdrs = await getHeaders();
        return hdrs.get('x-store-name');
    } catch {
        return null;
    }
}

/**
 * Read the current store's slug (set by middleware).
 */
export async function getStoreSlug(): Promise<string | null> {
    try {
        const hdrs = await getHeaders();
        return hdrs.get('x-store-slug');
    } catch {
        return null;
    }
}

interface VendureRequestOptions {
    token?: string;
    useAuthToken?: boolean;
    channelToken?: string;
    fetch?: RequestInit;
    tags?: string[];
}

interface VendureResponse<T> {
    data?: T;
    errors?: Array<{ message: string; [key: string]: unknown }>;
}

/**
 * Extract the Vendure auth token from response headers
 */
function extractAuthToken(headers: Headers): string | null {
    return headers.get(VENDURE_AUTH_TOKEN_HEADER);
}


/**
 * Execute a GraphQL query against the Vendure API
 */
export async function query<TResult, TVariables>(
    document: TadaDocumentNode<TResult, TVariables>,
    ...[variables, options]: TVariables extends Record<string, never>
        ? [variables?: TVariables, options?: VendureRequestOptions]
        : [variables: TVariables, options?: VendureRequestOptions]
): Promise<{ data: TResult; token?: string }> {
    const {
        token,
        useAuthToken,
        channelToken,
        fetch: fetchOptions,
        tags,
    } = options || {};

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions?.headers as Record<string, string>),
    };

    // Use the explicitly provided token, or fetch from cookies if useAuthToken is true
    let authToken = token;
    if (useAuthToken && !authToken) {
        authToken = await getAuthToken();
    }

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Set the channel token header — dynamic resolution from middleware, env fallback
    headers[VENDURE_CHANNEL_TOKEN_HEADER] = channelToken || await getChannelToken();

    const response = await fetch(getApiUrl(), {
        ...fetchOptions,
        method: 'POST',
        headers,
        body: JSON.stringify({
            query: print(document),
            variables: variables || {},
        }),
        ...(tags && {next: {tags}}),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: VendureResponse<TResult> = await response.json();

    if (result.errors) {
        throw new Error(result.errors.map(e => e.message).join(', '));
    }

    if (!result.data) {
        throw new Error('No data returned from Vendure API');
    }

    const newToken = extractAuthToken(response.headers);

    return {
        data: result.data,
        ...(newToken && {token: newToken}),
    };
}

/**
 * Execute a GraphQL mutation against the Vendure API
 */
export async function mutate<TResult, TVariables>(
    document: TadaDocumentNode<TResult, TVariables>,
    ...[variables, options]: TVariables extends Record<string, never>
        ? [variables?: TVariables, options?: VendureRequestOptions]
        : [variables: TVariables, options?: VendureRequestOptions]
): Promise<{ data: TResult; token?: string }> {
    // Mutations use the same underlying implementation as queries in GraphQL
    // @ts-expect-error - Complex conditional type inference, runtime behavior is correct
    return query(document, variables, options);
}
