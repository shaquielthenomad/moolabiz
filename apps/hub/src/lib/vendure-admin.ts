/**
 * Vendure Admin API client — creates channels and sellers for merchant provisioning.
 *
 * Uses plain fetch() for GraphQL calls against the Vendure Admin API.
 * Authenticates as superadmin and caches the auth token in memory.
 */

const VENDURE_ADMIN_API_URL =
  process.env.VENDURE_ADMIN_API_URL || "http://localhost:3000/admin-api";

function getVendureCredentials(): { username: string; password: string } {
  const username = process.env.VENDURE_SUPERADMIN_USERNAME;
  const password = process.env.VENDURE_SUPERADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "VENDURE_SUPERADMIN_USERNAME and VENDURE_SUPERADMIN_PASSWORD are required"
    );
  }
  return { username, password };
}

let cachedAuthToken: string | null = null;
let tokenExpiresAt = 0;

// Token is cached for 55 minutes (Vendure default session is 1 hour)
const TOKEN_TTL_MS = 55 * 60 * 1000;

// ─── GraphQL helper ─────────────────────────────────────────────────

interface GqlResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
  authToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(VENDURE_ADMIN_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Vendure Admin API HTTP ${res.status}: ${text.slice(0, 500)}`
    );
  }

  const json: GqlResponse<T> = await res.json();

  if (json.errors?.length) {
    const messages = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Vendure Admin API error: ${messages}`);
  }

  if (!json.data) {
    throw new Error("Vendure Admin API returned no data");
  }

  return json.data;
}

// ─── Authentication ─────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  if (cachedAuthToken && Date.now() < tokenExpiresAt) {
    return cachedAuthToken;
  }

  cachedAuthToken = await loginAndGetToken();
  tokenExpiresAt = Date.now() + TOKEN_TTL_MS;

  return cachedAuthToken;
}

async function loginAndGetToken(): Promise<string> {
  const { username, password } = getVendureCredentials();

  const res = await fetch(VENDURE_ADMIN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          __typename
          ... on CurrentUser { id identifier }
          ... on InvalidCredentialsError { errorCode message }
        }
      }`,
      variables: {
        username,
        password,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Vendure login HTTP ${res.status}`);
  }

  const json: GqlResponse<{
    login: { __typename: string; id?: string; message?: string };
  }> = await res.json();

  if (json.errors?.length) {
    throw new Error(
      `Vendure login error: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }

  if (json.data?.login.__typename !== "CurrentUser") {
    throw new Error(
      `Vendure login failed: ${json.data?.login.message || json.data?.login.__typename}`
    );
  }

  // Extract auth token from response header
  const token = res.headers.get("vendure-auth-token");
  if (!token) {
    throw new Error(
      "Vendure login succeeded but no auth token returned in headers. " +
        "Ensure the Vendure server is configured to return the vendure-auth-token header."
    );
  }

  return token;
}

/** Get an authenticated token, refreshing if needed. */
export async function getAuthToken(): Promise<string> {
  return authenticate();
}

/** Authenticated GraphQL call using the superadmin token. */
export async function adminGql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getAuthToken();
  return gql<T>(query, variables, token);
}

// ─── Channel management ─────────────────────────────────────────────

function generateChannelToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    token += chars[b % chars.length];
  }
  return token;
}

interface CreateChannelResult {
  channelId: string;
  channelToken: string;
}

/**
 * Create a Vendure channel for a merchant.
 * Each merchant gets their own channel with a unique token for storefront isolation.
 */
export async function createMerchantChannel(
  slug: string,
  businessName: string,
  currencyCode: string = "ZAR"
): Promise<CreateChannelResult> {
  const channelToken = generateChannelToken();

  const data = await adminGql<{
    createChannel: {
      __typename: string;
      id?: string;
      code?: string;
      token?: string;
      message?: string;
    };
  }>(
    `mutation CreateChannel($input: CreateChannelInput!) {
      createChannel(input: $input) {
        __typename
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
    }`,
    {
      input: {
        code: slug,
        token: channelToken,
        defaultLanguageCode: "en",
        defaultCurrencyCode: currencyCode,
        pricesIncludeTax: true,
        defaultShippingZoneId: "1",
        defaultTaxZoneId: "1",
      },
    }
  );

  if (data.createChannel.__typename !== "Channel") {
    throw new Error(
      `Failed to create channel: ${data.createChannel.message || data.createChannel.__typename}`
    );
  }

  console.log(
    `[vendure-admin] Created channel "${slug}" (id: ${data.createChannel.id})`
  );

  return {
    channelId: data.createChannel.id!,
    channelToken,
  };
}

/**
 * Create a Seller for a merchant and assign it to their channel.
 */
export async function createMerchantSeller(
  channelId: string,
  businessName: string
): Promise<{ sellerId: string }> {
  // 1. Create the seller
  const sellerData = await adminGql<{
    createSeller: { id: string; name: string };
  }>(
    `mutation CreateSeller($input: CreateSellerInput!) {
      createSeller(input: $input) {
        id
        name
      }
    }`,
    {
      input: {
        name: businessName,
      },
    }
  );

  const sellerId = sellerData.createSeller.id;

  // 2. Assign the seller to the channel
  // NOTE: Vendure 3.x may not have a dedicated `assignSellersToChannel` mutation.
  // We attempt it but don't let failure block provisioning — sellers are optional
  // for basic channel operation (products/orders work without seller assignment).
  try {
    await adminGql(
      `mutation AssignSellerToChannel($sellerId: ID!, $channelId: ID!) {
        assignSellersToChannel(channelId: $channelId, sellerIds: [$sellerId]) {
          id
          name
        }
      }`,
      { sellerId, channelId }
    );
    console.log(
      `[vendure-admin] Created seller "${businessName}" (id: ${sellerId}) and assigned to channel ${channelId}`
    );
  } catch (assignErr) {
    // TODO: Find the correct Vendure 3.x mutation for seller-channel assignment
    // if `assignSellersToChannel` doesn't exist in this version.
    console.warn(
      `[vendure-admin] Could not assign seller to channel (non-fatal):`,
      assignErr instanceof Error ? assignErr.message : assignErr
    );
    console.log(
      `[vendure-admin] Created seller "${businessName}" (id: ${sellerId}) — channel assignment skipped`
    );
  }

  return { sellerId };
}

/**
 * Delete a channel (cleanup on provisioning failure).
 */
export async function deleteMerchantChannel(
  channelId: string
): Promise<void> {
  await adminGql<{ deleteChannel: { result: string; message?: string } }>(
    `mutation DeleteChannel($id: ID!) {
      deleteChannel(id: $id) {
        result
        message
      }
    }`,
    { id: channelId }
  );

  console.log(`[vendure-admin] Deleted channel ${channelId}`);
}

/**
 * Create a default flat-rate shipping method assigned to a merchant's channel.
 * Vendure checkout requires at least one shipping method per channel.
 */
export async function createDefaultShippingMethod(
  channelId: string
): Promise<{ shippingMethodId: string }> {
  const data = await adminGql<{
    createShippingMethod: { id: string; code: string };
  }>(
    `mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
      createShippingMethod(input: $input) {
        id
        code
      }
    }`,
    {
      input: {
        code: `standard-shipping-ch${channelId}`,
        translations: [
          {
            languageCode: "en",
            name: "Standard Shipping",
            description: "Free delivery",
          },
        ],
        fulfillmentHandler: "manual-fulfillment",
        checker: {
          code: "default-shipping-eligibility-checker",
          arguments: [{ name: "orderMinimum", value: "0" }],
        },
        calculator: {
          code: "default-shipping-calculator",
          arguments: [
            { name: "rate", value: "0" },
            { name: "includesTax", value: "true" },
            { name: "taxRate", value: "0" },
          ],
        },
      },
    }
  );

  // Assign the shipping method to the merchant's channel
  await adminGql(
    `mutation AssignShippingMethodToChannel($input: AssignShippingMethodsToChannelInput!) {
      assignShippingMethodsToChannel(input: $input) {
        id
      }
    }`,
    {
      input: {
        shippingMethodIds: [data.createShippingMethod.id],
        channelId,
      },
    }
  );

  console.log(
    `[vendure-admin] Created default shipping method (id: ${data.createShippingMethod.id}) for channel ${channelId}`
  );

  return { shippingMethodId: data.createShippingMethod.id };
}

/**
 * Create a default payment method (Cash on Delivery / EFT / Direct Transfer)
 * assigned to a merchant's channel.
 * Uses the built-in dummy-payment-handler which auto-settles — perfect for
 * offline payment collection (cash, EFT, mobile money).
 */
export async function createDefaultPaymentMethod(
  channelId: string
): Promise<{ paymentMethodId: string }> {
  const data = await adminGql<{
    createPaymentMethod: { id: string; code: string };
  }>(
    `mutation CreatePaymentMethod($input: CreatePaymentMethodInput!) {
      createPaymentMethod(input: $input) {
        id
        code
      }
    }`,
    {
      input: {
        code: `cod-eft-${channelId}`,
        enabled: true,
        translations: [
          {
            languageCode: "en",
            name: "Cash on Delivery / EFT",
            description:
              "Pay the merchant directly via cash, EFT, or mobile payment",
          },
        ],
        handler: {
          code: "dummy-payment-handler",
          arguments: [],
        },
      },
    }
  );

  // Assign the payment method to the merchant's channel
  await adminGql(
    `mutation AssignPaymentMethodsToChannel($input: AssignPaymentMethodsToChannelInput!) {
      assignPaymentMethodsToChannel(input: $input) {
        id
      }
    }`,
    {
      input: {
        paymentMethodIds: [data.createPaymentMethod.id],
        channelId,
      },
    }
  );

  console.log(
    `[vendure-admin] Created default payment method (id: ${data.createPaymentMethod.id}) for channel ${channelId}`
  );

  return { paymentMethodId: data.createPaymentMethod.id };
}

/**
 * Look up a channel by its code (slug).
 * Returns null if not found.
 */
export async function getChannelByCode(
  slug: string
): Promise<{ id: string; code: string; token: string } | null> {
  const data = await adminGql<{
    channels: {
      items: Array<{ id: string; code: string; token: string }>;
    };
  }>(
    `query GetChannels {
      channels {
        items {
          id
          code
          token
        }
      }
    }`
  );

  const channel = data.channels.items.find((ch) => ch.code === slug);
  return channel || null;
}
