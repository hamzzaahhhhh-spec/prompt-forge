import type { PromptType } from "@/lib/types";

type HuggingFaceChatRequest = {
  input: string;
  type: PromptType;
  style: string;
  systemPrompt: string;
  signal?: AbortSignal;
};

type HuggingFaceResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_HF_URL = "https://router.huggingface.co/v1/chat/completions";

export async function callHuggingFaceChat({
  input,
  type,
  style,
  systemPrompt,
  signal,
}: HuggingFaceChatRequest): Promise<string> {
  const token = process.env.HF_API_TOKEN;
  const model = process.env.HF_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.2";
  const baseUrl = process.env.HF_BASE_URL ?? DEFAULT_HF_URL;

  if (!token) {
    throw new Error("HF_TOKEN_MISSING");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
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
      stream: false,
      max_tokens: 1400,
      temperature: 0.2,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HF_HTTP_${response.status}`);
  }

  const payload = (await response.json()) as HuggingFaceResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("HF_EMPTY_RESPONSE");
  }

  return content;
}
