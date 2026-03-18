import type { CoolifyApplication } from "./types";

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`${key} is not set`);
  return val;
}

function getConfig() {
  const url = getEnv("COOLIFY_API_URL");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("COOLIFY_API_URL must start with http:// or https://");
  }
  return {
    apiUrl: url,
    apiToken: getEnv("COOLIFY_API_TOKEN"),
    projectUuid: getEnv("COOLIFY_PROJECT_UUID"),
    serverUuid: getEnv("COOLIFY_SERVER_UUID"),
  };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createApplication(
  slug: string,
  businessName: string,
  domains: string
): Promise<CoolifyApplication> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.apiUrl}/api/v1/applications/public`, {
    method: "POST",
    headers: headers(cfg.apiToken),
    body: JSON.stringify({
      project_uuid: cfg.projectUuid,
      server_uuid: cfg.serverUuid,
      environment_name: "production",
      name: `bot-${slug}`,
      description: `MoolaBiz bot for ${businessName}`,
      domains,
      git_repository: "https://github.com/shaquielthenomad/moolabiz",
      git_branch: "main",
      build_pack: "nixpacks",
      base_directory: "/apps/bot",
      ports_exposes: "3000",
      instant_deploy: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Coolify createApplication failed (${res.status}):`, body);
    throw new Error("Failed to create application");
  }

  return res.json();
}

export async function setEnvironmentVariables(
  appUuid: string,
  vars: Record<string, string>
): Promise<void> {
  const cfg = getConfig();
  for (const [key, value] of Object.entries(vars)) {
    const res = await fetch(
      `${cfg.apiUrl}/api/v1/applications/${appUuid}/envs`,
      {
        method: "POST",
        headers: headers(cfg.apiToken),
        body: JSON.stringify({
          key,
          value,
          is_preview: false,
        }),
      }
    );

    if (res.status === 409) {
      // Already exists — skip (Coolify may auto-set some vars)
      console.log(`Coolify setEnv "${key}" already exists, skipping`);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`Coolify setEnv "${key}" failed (${res.status}):`, body);
      throw new Error("Failed to set environment variables");
    }
  }
}

export async function deployApplication(appUuid: string): Promise<void> {
  const cfg = getConfig();
  const res = await fetch(
    `${cfg.apiUrl}/api/v1/deploy`,
    {
      method: "POST",
      headers: headers(cfg.apiToken),
      body: JSON.stringify({ uuid: appUuid }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Coolify deploy failed (${res.status}):`, body);
    throw new Error("Failed to deploy application");
  }
}

export async function stopApplication(appUuid: string): Promise<void> {
  const cfg = getConfig();
  const res = await fetch(
    `${cfg.apiUrl}/api/v1/applications/${appUuid}/stop`,
    {
      method: "POST",
      headers: headers(cfg.apiToken),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Coolify stop failed (${res.status}):`, body);
    throw new Error("Failed to stop application");
  }
}

export async function startApplication(appUuid: string): Promise<void> {
  const cfg = getConfig();
  const res = await fetch(
    `${cfg.apiUrl}/api/v1/applications/${appUuid}/start`,
    {
      method: "POST",
      headers: headers(cfg.apiToken),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Coolify start failed (${res.status}):`, body);
    throw new Error("Failed to start application");
  }
}
