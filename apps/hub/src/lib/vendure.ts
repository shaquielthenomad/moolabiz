/**
 * Vendure Admin API client helper.
 *
 * Every call requires a channel token so that the query is scoped
 * to the correct merchant channel inside Vendure.
 *
 * Authentication is handled dynamically via vendure-admin.ts (superadmin login).
 */

const VENDURE_ADMIN_API_URL =
  process.env.VENDURE_ADMIN_API_URL || "http://vendure-server:3000/admin-api";

interface VendureResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export async function vendureAdminQuery<T = unknown>(
  channelToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  // Import the dynamic auth token from vendure-admin.ts
  const { getAuthToken } = await import("./vendure-admin");
  const authToken = await getAuthToken();

  const res = await fetch(VENDURE_ADMIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "vendure-token": channelToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Vendure API error: ${res.status} ${res.statusText}`);
  }

  const json: VendureResponse<T> = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  return json.data as T;
}

// ---------------------------------------------------------------------------
// Asset upload helper
// ---------------------------------------------------------------------------

const CREATE_ASSETS_MUTATION = `
  mutation CreateAssets($input: [CreateAssetInput!]!) {
    createAssets(input: $input) {
      ... on Asset {
        id
        name
        preview
        source
      }
      ... on MimeTypeError {
        errorCode
        message
      }
    }
  }
`;

/**
 * Upload an image file to Vendure's asset server via the Admin API multipart upload.
 * Returns the asset ID on success.
 */
export async function uploadAssetToVendure(
  channelToken: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ assetId: string; preview: string }> {
  const { getAuthToken } = await import("./vendure-admin");
  const authToken = await getAuthToken();

  const VENDURE_URL =
    process.env.VENDURE_ADMIN_API_URL || "http://vendure-server:3000/admin-api";

  // Vendure uses the GraphQL multipart request spec
  // https://github.com/jaydenseric/graphql-multipart-request-spec
  const operations = JSON.stringify({
    query: CREATE_ASSETS_MUTATION,
    variables: {
      input: [{ file: null }],
    },
  });

  const map = JSON.stringify({
    "0": ["variables.input.0.file"],
  });

  const formData = new FormData();
  formData.append("operations", operations);
  formData.append("map", map);
  formData.append("0", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename);

  const res = await fetch(VENDURE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "vendure-token": channelToken,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asset upload failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }

  const result = json.data?.createAssets?.[0];
  if (!result?.id) {
    throw new Error(
      `Asset upload returned unexpected result: ${JSON.stringify(result)}`
    );
  }

  return { assetId: result.id, preview: result.preview || "" };
}

// ---------------------------------------------------------------------------
// GraphQL fragments & queries used by the bridge routes
// ---------------------------------------------------------------------------

export const ADMIN_PRODUCT_FIELDS = `
  fragment AdminProductFields on Product {
    id
    name
    slug
    description
    enabled
    featuredAsset { id preview }
    variants {
      id
      name
      sku
      price
      priceWithTax
      stockOnHand
      trackInventory
      enabled
      options { id code name group { id name } }
    }
    optionGroups { id name options { id code name } }
    collections { id name slug }
  }
`;

export const LIST_PRODUCTS_QUERY = `
  ${ADMIN_PRODUCT_FIELDS}
  query ListProducts($options: ProductListOptions) {
    products(options: $options) {
      totalItems
      items { ...AdminProductFields }
    }
  }
`;

export const COUNT_PRODUCTS_QUERY = `
  query CountProducts($options: ProductListOptions) {
    products(options: $options) {
      totalItems
    }
  }
`;

export const GET_PRODUCT_QUERY = `
  ${ADMIN_PRODUCT_FIELDS}
  query GetProduct($id: ID!) {
    product(id: $id) { ...AdminProductFields }
  }
`;

export const CREATE_PRODUCT_MUTATION = `
  ${ADMIN_PRODUCT_FIELDS}
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) { ...AdminProductFields }
  }
`;

export const CREATE_PRODUCT_VARIANTS_MUTATION = `
  mutation CreateProductVariants($input: [CreateProductVariantInput!]!) {
    createProductVariants(input: $input) {
      id name sku price priceWithTax stockOnHand enabled
      options { id code name group { id name } }
    }
  }
`;

export const UPDATE_PRODUCT_MUTATION = `
  ${ADMIN_PRODUCT_FIELDS}
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) { ...AdminProductFields }
  }
`;

export const UPDATE_PRODUCT_VARIANTS_MUTATION = `
  mutation UpdateProductVariants($input: [UpdateProductVariantInput!]!) {
    updateProductVariants(input: $input) {
      id name sku price priceWithTax stockOnHand enabled
      options { id code name group { id name } }
    }
  }
`;

export const DELETE_PRODUCT_MUTATION = `
  mutation DeleteProduct($id: ID!) {
    deleteProduct(id: $id) { result message }
  }
`;

export const LIST_ORDERS_QUERY = `
  query ListOrders($options: OrderListOptions) {
    orders(options: $options) {
      totalItems
      items {
        id
        code
        state
        totalWithTax
        currencyCode
        createdAt
        updatedAt
        customer { id firstName lastName emailAddress phoneNumber }
        lines {
          id
          quantity
          linePriceWithTax
          productVariant { id name sku product { id name } }
        }
        shippingAddress { fullName streetLine1 city province postalCode country phoneNumber }
      }
    }
  }
`;

export const TRANSITION_ORDER_STATE_MUTATION = `
  mutation TransitionOrderToState($id: ID!, $state: String!) {
    transitionOrderToState(id: $id, state: $state) {
      ... on Order {
        id
        code
        state
      }
      ... on OrderStateTransitionError {
        errorCode
        message
        transitionError
        fromState
        toState
      }
    }
  }
`;

export const GET_ORDER_QUERY = `
  query GetOrder($id: ID!) {
    order(id: $id) {
      id
      code
      state
      totalWithTax
      currencyCode
      createdAt
      updatedAt
      customer { id firstName lastName emailAddress phoneNumber }
      lines {
        id
        quantity
        linePriceWithTax
        productVariant { id name sku product { id name } }
      }
      shippingAddress { fullName streetLine1 city province postalCode country phoneNumber }
    }
  }
`;

// ---------------------------------------------------------------------------
// Simplification helpers — turn Vendure responses into bot-friendly objects
// ---------------------------------------------------------------------------

export interface SimpleProduct {
  id: string;
  name: string;
  price: number; // in cents
  description: string;
  category: string;
  inStock: boolean;
  imageUrl: string;
  sku: string;
  stockQuantity: number;
  variants: SimpleVariant[];
}

export interface SimpleVariant {
  id: string;
  name: string;
  price: number;
  sku: string;
  stockOnHand: number;
  inStock: boolean;
  options: Record<string, string>;
}

export interface SimpleOrder {
  id: string;
  code: string;
  status: string;
  total: number; // cents
  currency: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simplifyProduct(p: any): SimpleProduct {
  const defaultVariant = p.variants?.[0];
  return {
    id: p.id,
    name: p.name,
    price: defaultVariant?.price ?? 0,
    description: (p.description || "").replace(/<[^>]*>/g, ""), // strip HTML
    category: p.collections?.[0]?.name || "",
    inStock: p.enabled !== false && (defaultVariant?.stockOnHand ?? 0) > 0,
    imageUrl: p.featuredAsset?.preview || "",
    sku: defaultVariant?.sku || "",
    stockQuantity: defaultVariant?.stockOnHand ?? 0,
    variants: (p.variants || []).map(simplifyVariant),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simplifyVariant(v: any): SimpleVariant {
  const options: Record<string, string> = {};
  for (const opt of v.options || []) {
    options[opt.group?.name || opt.code] = opt.name;
  }
  return {
    id: v.id,
    name: v.name,
    price: v.price ?? 0,
    sku: v.sku || "",
    stockOnHand: v.stockOnHand ?? 0,
    inStock: v.enabled !== false && (v.stockOnHand ?? 0) > 0,
    options,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function simplifyOrder(o: any): SimpleOrder {
  const addr = o.shippingAddress;
  return {
    id: o.id,
    code: o.code,
    status: o.state,
    total: o.totalWithTax ?? 0,
    currency: o.currencyCode || "ZAR",
    createdAt: o.createdAt,
    customerName:
      [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") ||
      addr?.fullName ||
      "Unknown",
    customerPhone: o.customer?.phoneNumber || addr?.phoneNumber || "",
    items: (o.lines || []).map((l: any) => ({
      name: l.productVariant?.name || l.productVariant?.product?.name || "",
      quantity: l.quantity,
      price: l.linePriceWithTax ?? 0,
    })),
    shippingAddress: addr
      ? [addr.streetLine1, addr.city, addr.province, addr.postalCode]
          .filter(Boolean)
          .join(", ")
      : "",
  };
}
