type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type HuggingFaceChatRequest = {
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  requestId?: string;
};

type HuggingFaceResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>;
    };
  }>;
};

const DEFAULT_HF_URL = "https://router.huggingface.co/v1/chat/completions";

function getFirstNonEmptyEnv(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function getHuggingFaceConfig() {
  const token = getFirstNonEmptyEnv([
    "HF_API_TOKEN",
    "HUGGINGFACE_API_KEY",
    "HUGGING_FACE_API_TOKEN",
  ]);
  const model =
    getFirstNonEmptyEnv(["HF_MODEL", "HUGGINGFACE_MODEL"]) ||
    "meta-llama/Llama-3.1-8B-Instruct";
  const baseUrl =
    getFirstNonEmptyEnv(["HF_BASE_URL", "HUGGINGFACE_BASE_URL"]) || DEFAULT_HF_URL;

  return { token, model, baseUrl };
}

function trimSnippet(value: string, maxLength = 280): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function toContentText(
  content: string | Array<{ text?: string; type?: string }> | undefined,
): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export async function callHuggingFaceChat({
  messages,
  signal,
  maxTokens = 3200,
  temperature = 0.2,
  requestId,
}: HuggingFaceChatRequest): Promise<string> {
  const { token, model, baseUrl } = getHuggingFaceConfig();

  if (!token) {
    throw new Error("PROVIDER_CONFIG_MISSING");
  }

  try {
    const parsedBaseUrl = new URL(baseUrl);
    if (!parsedBaseUrl.protocol.startsWith("http")) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error("HF_CONFIG_INVALID_BASE_URL");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.9,
    }),
    signal,
  });

  if (!response.ok) {
    const bodyText = trimSnippet(await response.text().catch(() => ""));
    throw new Error(`HF_HTTP_${response.status}:${bodyText}`);
  }

  const payload = (await response.json()) as HuggingFaceResponse;
  const content = toContentText(payload.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("HF_EMPTY_RESPONSE");
  }

  return content;
}
