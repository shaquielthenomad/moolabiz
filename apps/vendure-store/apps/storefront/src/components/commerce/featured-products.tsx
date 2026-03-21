import {ProductCarousel} from "@/components/commerce/product-carousel";
import {query} from "@/lib/vendure/api";
import {GetCollectionProductsQuery, SearchProductsQuery} from "@/lib/vendure/queries";

async function getFeaturedCollectionProducts() {
    // Try fetching from a "featured" collection first, then fall back to all products
    const collectionSlugs = ["featured", "electronics"];

    for (const slug of collectionSlugs) {
        try {
            const result = await query(GetCollectionProductsQuery, {
                slug,
                input: {
                    collectionSlug: slug,
                    take: 12,
                    skip: 0,
                    groupByProduct: true,
                },
            });

            if (result.data.search.items.length > 0) {
                return result.data.search.items;
            }
        } catch {
            // Collection doesn't exist or query failed, try next
        }
    }

    // Fallback: fetch all products (no collection filter)
    try {
        const result = await query(SearchProductsQuery, {
            input: {
                take: 12,
                skip: 0,
                groupByProduct: true,
            },
        });

        return result.data.search.items;
    } catch {
        // API unreachable — return empty array so the page still renders
        return [];
    }
}


export async function FeaturedProducts() {
    const products = await getFeaturedCollectionProducts();

    if (products.length === 0) {
        return null;
    }

    return (
        <ProductCarousel
            title="Featured Products"
            products={products}
        />
    );
}
