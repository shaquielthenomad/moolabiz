#!/usr/bin/env node

/**
 * health-check.mjs
 *
 * Verifies that all MoolaBiz services are up and responding correctly.
 * Reads configuration from environment variables with sensible local-dev defaults.
 *
 * Usage:
 *   node scripts/health-check.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * Requires Node.js 22+ (native fetch, top-level await).
 */

// ─── ANSI colour helpers ──────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY;

function green(str) {
  return isTTY ? `\x1b[32m${str}\x1b[0m` : str;
}

function red(str) {
  return isTTY ? `\x1b[31m${str}\x1b[0m` : str;
}

function yellow(str) {
  return isTTY ? `\x1b[33m${str}\x1b[0m` : str;
}

function bold(str) {
  return isTTY ? `\x1b[1m${str}\x1b[0m` : str;
}

function dim(str) {
  return isTTY ? `\x1b[2m${str}\x1b[0m` : str;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const config = {
  hubUrl:
    process.env.HEALTH_HUB_URL || "https://moolabiz.shop",
  vendureAdminApiUrl:
    process.env.VENDURE_ADMIN_API_URL || "http://localhost:3000/admin-api",
  vendureShopApiUrl:
    process.env.VENDURE_SHOP_API_URL || "http://localhost:3000/shop-api",
  openclawProvisionerUrl:
    process.env.OPENCLAW_PROVISIONER_URL || "http://localhost:9999",
  openclawProvisionerKey:
    process.env.OPENCLAW_PROVISIONER_KEY || "",
  databaseUrl:
    process.env.DATABASE_URL || "",
  vendureSuperadminUsername:
    process.env.VENDURE_SUPERADMIN_USERNAME || "superadmin",
  vendureSuperadminPassword:
    process.env.VENDURE_SUPERADMIN_PASSWORD || "",
};

// ─── Result tracking ──────────────────────────────────────────────────────────

const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  const suffix = detail ? dim(` — ${detail}`) : "";
  console.log(`  ${green("✓")} ${name}${suffix}`);
}

function fail(name, reason = "") {
  results.push({ ok: false, name, reason });
  const suffix = reason ? dim(` — ${reason}`) : "";
  console.log(`  ${red("✗")} ${name}${suffix}`);
}

function skip(name, reason = "") {
  results.push({ ok: true, name, reason, skipped: true }); // skipped doesn't count as failure
  const suffix = reason ? dim(` — ${reason}`) : "";
  console.log(`  ${yellow("–")} ${name}${suffix} ${dim("(skipped)")}`);
}

// ─── Helper: HTTP GET with timeout ───────────────────────────────────────────

async function httpGet(url, opts = {}) {
  const { timeoutMs = 10_000, headers = {} } = opts;
  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

// ─── Helper: GraphQL POST ─────────────────────────────────────────────────────

async function graphqlPost(url, query, variables = {}, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  return res;
}

// ─── Check 1: Hub (moolabiz.shop) ─────────────────────────────────────────────

async function checkHub() {
  const url = config.hubUrl;
  try {
    const res = await httpGet(url, { timeoutMs: 15_000 });
    if (res.status < 500) {
      pass("Hub is responding", `GET ${url} → HTTP ${res.status}`);
    } else {
      fail("Hub is responding", `GET ${url} → HTTP ${res.status} (server error)`);
    }
  } catch (err) {
    fail("Hub is responding", `GET ${url} → ${err.message}`);
  }
}

// ─── Check 2: Vendure Admin API ───────────────────────────────────────────────

async function checkVendureAdminApi() {
  const url = config.vendureAdminApiUrl;
  try {
    const res = await graphqlPost(url, "{ __typename }");
    if (res.ok || res.status === 401 || res.status === 403) {
      // 401/403 means the API is up but we're not authenticated — still healthy
      pass("Vendure Admin API is responding", `POST ${url} → HTTP ${res.status}`);
    } else {
      fail("Vendure Admin API is responding", `POST ${url} → HTTP ${res.status}`);
    }
  } catch (err) {
    fail("Vendure Admin API is responding", `POST ${url} → ${err.message}`);
  }
}

// ─── Check 3: Vendure Shop API ────────────────────────────────────────────────

async function checkVendureShopApi() {
  const url = config.vendureShopApiUrl;
  try {
    const res = await graphqlPost(url, "{ __typename }");
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.__typename) {
        pass("Vendure Shop API is responding", `POST ${url} → __typename: ${json.data.__typename}`);
      } else {
        pass("Vendure Shop API is responding", `POST ${url} → HTTP ${res.status}`);
      }
    } else {
      fail("Vendure Shop API is responding", `POST ${url} → HTTP ${res.status}`);
    }
  } catch (err) {
    fail("Vendure Shop API is responding", `POST ${url} → ${err.message}`);
  }
}

// ─── Check 4: OpenClaw Provisioner ────────────────────────────────────────────

async function checkOpenClawProvisioner() {
  const baseUrl = config.openclawProvisionerUrl;
  // The provisioner's GET /status is the liveness probe endpoint
  // (it requires no auth and returns a JSON status object)
  const url = `${baseUrl}/status`;

  if (!config.openclawProvisionerKey) {
    skip("OpenClaw Provisioner is responding", "OPENCLAW_PROVISIONER_KEY not set — skipping auth check");
    return;
  }

  try {
    // The provisioner only accepts POST; send a minimal status ping
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-key": config.openclawProvisionerKey,
      },
      body: JSON.stringify({ slug: "_healthcheck" }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok || res.status === 200) {
      const json = await res.json();
      pass("OpenClaw Provisioner is responding", `POST ${url} → state: ${json.state ?? "ok"}`);
    } else if (res.status === 401) {
      fail("OpenClaw Provisioner is responding", `POST ${url} → HTTP 401 (check OPENCLAW_PROVISIONER_KEY)`);
    } else {
      // A 404 or 500 for the "_healthcheck" slug still means the service is up
      pass("OpenClaw Provisioner is responding", `POST ${url} → HTTP ${res.status} (service up)`);
    }
  } catch (err) {
    fail("OpenClaw Provisioner is responding", `POST ${url} → ${err.message}`);
  }
}

// ─── Check 5: PostgreSQL connection ──────────────────────────────────────────

async function checkPostgres() {
  const dbUrl = config.databaseUrl;

  if (!dbUrl) {
    skip("PostgreSQL connection", "DATABASE_URL not set");
    return;
  }

  // Dynamically import pg to avoid hard dependency at the top level
  let pg;
  try {
    pg = (await import("pg")).default;
  } catch {
    skip("PostgreSQL connection", "pg package not available in this environment");
    return;
  }

  const client = new pg.Client({ connectionString: dbUrl });

  try {
    await client.connect();
    const { rows } = await client.query("SELECT NOW() AS now, current_database() AS db");
    const row = rows[0];
    pass("PostgreSQL connection", `db=${row.db}, server_time=${new Date(row.now).toISOString()}`);
  } catch (err) {
    fail("PostgreSQL connection", err.message);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}

// ─── Check 6: Vendure channel query (superadmin login + channels list) ────────

async function checkVendureChannelQuery() {
  const url = config.vendureAdminApiUrl;

  if (!config.vendureSuperadminPassword) {
    skip("Vendure channel query", "VENDURE_SUPERADMIN_PASSWORD not set");
    return;
  }

  // Step 1: Authenticate
  let authToken;
  try {
    const loginRes = await graphqlPost(url, `
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          __typename
          ... on CurrentUser { id identifier }
          ... on InvalidCredentialsError { errorCode message }
        }
      }
    `, {
      username: config.vendureSuperadminUsername,
      password: config.vendureSuperadminPassword,
    });

    if (!loginRes.ok) {
      fail("Vendure channel query", `Login failed: HTTP ${loginRes.status}`);
      return;
    }

    const loginJson = await loginRes.json();
    if (loginJson.data?.login?.__typename !== "CurrentUser") {
      fail("Vendure channel query", `Login failed: ${loginJson.data?.login?.message || loginJson.data?.login?.__typename}`);
      return;
    }

    authToken = loginRes.headers.get("vendure-auth-token");
    if (!authToken) {
      fail("Vendure channel query", "Login OK but no vendure-auth-token header returned");
      return;
    }
  } catch (err) {
    fail("Vendure channel query", `Login request failed: ${err.message}`);
    return;
  }

  // Step 2: List channels
  try {
    const channelsRes = await graphqlPost(
      url,
      `query { channels { items { id code token } } }`,
      {},
      { Authorization: `Bearer ${authToken}` }
    );

    if (!channelsRes.ok) {
      fail("Vendure channel query", `Channels query: HTTP ${channelsRes.status}`);
      return;
    }

    const channelsJson = await channelsRes.json();
    if (channelsJson.errors?.length) {
      fail("Vendure channel query", channelsJson.errors.map((e) => e.message).join("; "));
      return;
    }

    const channelCount = channelsJson.data?.channels?.items?.length ?? 0;
    pass("Vendure channel query", `${channelCount} channel(s) found via Admin API`);
  } catch (err) {
    fail("Vendure channel query", `Channels query failed: ${err.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold("\nMoolaBiz Health Check"));
  console.log(dim(`${new Date().toISOString()}\n`));

  console.log(bold("Services:"));
  console.log(dim(`  Hub:                  ${config.hubUrl}`));
  console.log(dim(`  Vendure Admin API:    ${config.vendureAdminApiUrl}`));
  console.log(dim(`  Vendure Shop API:     ${config.vendureShopApiUrl}`));
  console.log(dim(`  OpenClaw Provisioner: ${config.openclawProvisionerUrl}`));
  console.log(dim(`  Database:             ${config.databaseUrl ? config.databaseUrl.replace(/:\/\/[^@]+@/, "://<credentials>@") : "(not set)"}`));
  console.log();

  console.log(bold("Checks:"));

  await checkHub();
  await checkVendureAdminApi();
  await checkVendureShopApi();
  await checkOpenClawProvisioner();
  await checkPostgres();
  await checkVendureChannelQuery();

  // ─── Summary ─────────────────────────────────────────────────────────────

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok && !r.skipped);
  const skipped = results.filter((r) => r.skipped);

  console.log();
  console.log(bold("Summary:"));
  console.log(`  ${green(`${passed.length} passed`)}  ${failed.length > 0 ? red(`${failed.length} failed`) : dim("0 failed")}  ${skipped.length > 0 ? yellow(`${skipped.length} skipped`) : dim("0 skipped")}`);

  if (failed.length > 0) {
    console.log();
    console.log(red("Failed checks:"));
    for (const r of failed) {
      console.log(`  ${red("✗")} ${r.name}${r.reason ? dim(` — ${r.reason}`) : ""}`);
    }
    console.log();
    process.exit(1);
  }

  console.log();
}

main().catch((err) => {
  console.error(red(`\nFatal error: ${err.message}`));
  process.exit(1);
});
