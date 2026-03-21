import {query} from './api';
import {GetActiveChannelQuery, GetAvailableCountriesQuery, GetTopCollectionsQuery} from './queries';

/**
 * Get the active channel.
 * In multi-tenant mode the channel is resolved per-request from the subdomain,
 * so we cannot use `'use cache'` (it calls headers() which is dynamic).
 */
export async function getActiveChannelCached() {
    try {
        const result = await query(GetActiveChannelQuery);
        return result.data.activeChannel;
    } catch {
        // API unreachable at build time — return sensible defaults
        return {
            id: '',
            code: '__default_channel__',
            defaultLanguageCode: 'en',
            availableLanguageCodes: ['en'],
            defaultCurrencyCode: 'ZAR',
            availableCurrencyCodes: ['ZAR'],
        };
    }
}

/**
 * Get available countries.
 */
export async function getAvailableCountriesCached() {
    const result = await query(GetAvailableCountriesQuery);
    return result.data.availableCountries || [];
}

/**
 * Get top-level collections.
 */
export async function getTopCollections() {
    const result = await query(GetTopCollectionsQuery);
    return result.data.collections.items;
}
