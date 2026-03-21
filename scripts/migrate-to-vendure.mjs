#!/usr/bin/env node

/**
 * migrate-to-vendure.mjs
 *
 * Migrates active merchants to Vendure:
 *   1. Creates a Vendure Channel (code = slug, currency = ZAR)
 *   2. Creates a Vendure Seller for the merchant
 *   3. Reads products from the merchant's current bot API
 *   4. Creates each product in Vendure under the merchant's channel
 *   5. Updates the hub DB with vendureChannelId and vendureChannelToken
 *
 * Idempotent — merchants that already have a vendureChannelToken are skipped.
 *
 * Usage:
 *   DATABASE_URL=postgres://... \
 *   VENDURE_ADMIN_API_URL=http://localhost:3100/admin-api \
 *   VENDURE_ADMIN_AUTH_TOKEN=... \
 *   node scripts/migrate-to-vendure.mjs
 *
 * Requires Node.js 22+ (native fetch, top-level await).
 */

import pg from "pg";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
const VENDURE_ADMIN_API_URL =
  process.env.VENDURE_ADMIN_API_URL || "http://localhost:3100/admin-api";
const VENDURE_ADMIN_AUTH_TOKEN = process.env.VENDURE_ADMIN_AUTH_TOKEN || "";

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

if (!VENDURE_ADMIN_AUTH_TOKEN) {
  console.error(
    "ERROR: VENDURE_ADMIN_AUTH_TOKEN environment variable is required."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Vendure Admin API helpers
// ---------------------------------------------------------------------------

async function vendureAdmin(query, variables = {}) {
  const res = await fetch(VENDURE_ADMIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VENDURE_ADMIN_AUTH_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vendure API ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      `Vendure GraphQL: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }
  return json.data;
}

/**
 * Execute a query scoped to a specific channel token.
 */
async function vendureAdminScoped(channelToken, query, variables = {}) {
  const res = await fetch(VENDURE_ADMIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VENDURE_ADMIN_AUTH_TOKEN}`,
      "vendure-token": channelToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vendure API ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      `Vendure GraphQL: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const FIND_CHANNEL_BY_CODE = `
  query FindChannel($code: String!) {
    channels(options: { filter: { code: { eq: $code } }, take: 1 }) {
      items { id code token }
    }
  }
`;

const CREATE_CHANNEL = `
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      ... on Channel {
        id
        code
        token
      }
      ... on LanguageNotAvailableError {
        errorCode
        message
      }
    }
  }
`;

const CREATE_SELLER = `
  mutation CreateSeller($input: CreateSellerInput!) {
    createSeller(input: $input) {
      id
      name
    }
  }
`;

const CREATE_PRODUCT = `
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      id
      name
      slug
    }
  }
`;

const CREATE_PRODUCT_VARIANTS = `
  mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
    createProductVariants(input: $input) {
      id
      name
      sku
      price
    }
  }
`;

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

async function findOrCreateChannel(slug, businessName) {
  // Check if channel already exists
  const existing = await vendureAdmin(FIND_CHANNEL_BY_CODE, { code: slug });
  const found = existing.channels?.items?.[0];
  if (found) {
    console.log(`    Channel "${slug}" already exists (id=${found.id})`);
    return { id: found.id, token: found.token };
  }

  // Create new channel
  const data = await vendureAdmin(CREATE_CHANNEL, {
    input: {
      code: slug,
      defaultLanguageCode: "en",
      pricesIncludeTax: true,
      currencyCode: "ZAR",
      defaultCurrencyCode: "ZAR",
      defaultShippingZoneId: "1",
      defaultTaxZoneId: "1",
      token: `${slug}-${Date.now().toString(36)}`,
    },
  });

  const channel = data.createChannel;
  if (channel.errorCode) {
    throw new Error(`Failed to create channel: ${channel.message}`);
  }

  console.log(
    `    Created channel "${slug}" (id=${channel.id}, token=${channel.token})`
  );
  return { id: channel.id, token: channel.token };
}

async function createSeller(businessName) {
  try {
    const data = await vendureAdmin(CREATE_SELLER, {
      input: {
        name: businessName,
      },
    });
    console.log(`    Created seller "${businessName}" (id=${data.createSeller.id})`);
    return data.createSeller;
  } catch (err) {
    // Seller might already exist — not critical
    console.log(`    Seller creation skipped: ${err.message}`);
    return null;
  }
}

async function fetchBotProducts(slug) {
  const url = `https://${slug}.bot.moolabiz.shop/api/products`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.log(`    Bot API returned ${res.status} — no products to migrate`);
      return [];
    }
    const data = await res.json();
    // Support both { products: [...] } and direct array responses
    return Array.isArray(data) ? data : data.products || [];
  } catch (err) {
    console.log(`    Could not reach bot API (${url}): ${err.message}`);
    return [];
  }
}

function makeSlug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now().toString(36)
  );
}

async function migrateProducts(channelToken, products) {
  let created = 0;
  let failed = 0;

  for (const product of products) {
    const name = product.name || product.title || "Untitled";
    const slug = makeSlug(name);
    const description = product.description || "";
    const price = typeof product.price === "number" ? product.price : 0;

    try {
      const productData = await vendureAdminScoped(
        channelToken,
        CREATE_PRODUCT,
        {
          input: {
            enabled: true,
            translations: [
              {
                languageCode: "en",
                name,
                slug,
                description,
              },
            ],
          },
        }
      );

      const productId = productData.createProduct.id;

      await vendureAdminScoped(channelToken, CREATE_PRODUCT_VARIANTS, {
        input: [
          {
            productId,
            sku: slug,
            price,
            stockOnHand: product.stockQuantity ?? product.stock ?? 100,
            trackInventory: "TRUE",
            translations: [{ languageCode: "en", name }],
          },
        ],
      });

      created++;
    } catch (err) {
      console.log(`    Failed to create product "${name}": ${err.message}`);
      failed++;
    }
  }

  return { created, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== MoolaBiz -> Vendure Migration ===\n");
  console.log(`Vendure Admin API: ${VENDURE_ADMIN_API_URL}`);

  // Connect to PostgreSQL
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    // Verify Vendure is reachable
    await vendureAdmin("{ __typename }");
    console.log("Vendure Admin API is reachable.\n");
  } catch (err) {
    console.error(`Cannot reach Vendure Admin API: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  try {
    // Fetch merchants that need migration
    const { rows: merchants } = await pool.query(
      `SELECT id, business_name, slug, status, vendure_channel_id, vendure_channel_token
       FROM merchants
       WHERE status = 'active'
       ORDER BY created_at ASC`
    );

    console.log(`Found ${merchants.length} active merchant(s).\n`);

    let migrated = 0;
    let skipped = 0;
    let errored = 0;

    for (const merchant of merchants) {
      const { id, business_name, slug, vendure_channel_token } = merchant;

      console.log(`--- ${business_name} (${slug}) ---`);

      // Idempotency: skip if already migrated
      if (vendure_channel_token) {
        console.log("    Already migrated — skipping.\n");
        skipped++;
        continue;
      }

      try {
        // Step 1: Create or find channel
        const channel = await findOrCreateChannel(slug, business_name);

        // Step 2: Create seller
        await createSeller(business_name);

        // Step 3: Fetch products from bot API
        const products = await fetchBotProducts(slug);
        console.log(`    Found ${products.length} product(s) in bot API.`);

        // Step 4: Create products in Vendure
        if (products.length > 0) {
          const result = await migrateProducts(channel.token, products);
          console.log(
            `    Products: ${result.created} created, ${result.failed} failed.`
          );
        }

        // Step 5: Update merchant record in hub DB
        await pool.query(
          `UPDATE merchants
           SET vendure_channel_id = $1,
               vendure_channel_token = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [channel.id, channel.token, id]
        );

        console.log("    Hub DB updated.\n");
        migrated++;
      } catch (err) {
        console.error(`    ERROR: ${err.message}\n`);
        errored++;
      }
    }

    // Summary
    console.log("=== Migration Summary ===");
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped (already done): ${skipped}`);
    console.log(`  Errors: ${errored}`);
    console.log(`  Total: ${merchants.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
