import { readFile } from "fs/promises";

const SOUL_PATH = process.env.SOUL_PATH || "/workspace/SOUL.md";

const DEFAULT_PROMPT = `You are a helpful business assistant powered by MoolaBiz.
Be friendly, concise, and help customers with their questions about products, services, and orders.`;

/**
 * Strip lines that look like prompt injection attempts.
 */
function sanitizeBusinessName(name: string): string {
  const dangerous =
    /\b(IGNORE|INSTRUCTION|SYSTEM|OVERRIDE)\b|```/i;
  return name
    .split("\n")
    .filter((line) => !dangerous.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getSoulPrompt(): Promise<string> {
  try {
    let content = await readFile(SOUL_PATH, "utf-8");

    // Sanitize business name before injecting into template
    const businessName = sanitizeBusinessName(
      process.env.BUSINESS_NAME || "MoolaBiz Shop"
    );
    content = content.replace(/\{\{BUSINESS_NAME\}\}/g, businessName);

    return content;
  } catch {
    console.warn(
      `[soul] Could not read ${SOUL_PATH}, using default system prompt`
    );
    return DEFAULT_PROMPT;
  }
}
