import type { PromptType } from "@/lib/types";

type OllamaChatRequest = {
  input: string;
  type: PromptType;
  style: string;
  systemPrompt: string;
  signal?: AbortSignal;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

const cleanBaseUrl = (raw: string) => raw.replace(/\/+$/, "");

export async function callOllamaChat({
  input,
  type,
  style,
  systemPrompt,
  signal,
}: OllamaChatRequest): Promise<string> {
  const base = cleanBaseUrl(process.env.OLLAMA_BASE_URL ?? "http://localhost:11434");
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";

  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            `Prompt type: ${type}`,
            `Requested style: ${style}`,
            "Transform the following source text into a high-quality prompt:",
            input,
          ].join("\n\n"),
        },
      ],
      options: {
        temperature: 0.2,
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
