const OLLAMA_URL = process.env.OLLAMA_URL || "http://ollama:11434";
const MODEL = "llama3.2:3b";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OllamaChatResponse {
  message: {
    role: "user" | "assistant" | "system";
    content: string;
  };
}

export async function chat(
  systemPrompt: string,
  messages: Message[]
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
  }

  const data: OllamaChatResponse = await response.json();
  return data.message.content;
}
