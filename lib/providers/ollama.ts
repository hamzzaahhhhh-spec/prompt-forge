type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatRequest = {
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

const cleanBaseUrl = (raw: string) => raw.replace(/\/+$/, "");

export async function callOllamaChat({
  messages,
  signal,
  maxTokens = 3200,
  temperature = 0.2,
}: OllamaChatRequest): Promise<string> {
  const base = cleanBaseUrl(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434");
  const model = process.env.OLLAMA_MODEL?.trim();

  if (!model) {
    throw new Error("PROVIDER_CONFIG_MISSING");
  }

  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OLLAMA_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as OllamaResponse;
  const content = payload.message?.content?.trim();

  if (!content) {
    throw new Error("OLLAMA_EMPTY_RESPONSE");
  }

  return content;
}
