import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/providers/huggingface", () => ({
  callHuggingFaceChat: vi.fn(),
}));

vi.mock("@/lib/providers/ollama", () => ({
  callOllamaChat: vi.fn(),
}));

vi.mock("@/lib/admin/realtime", () => ({
  getAdminConfig: vi.fn(),
  recordAdminActivity: vi.fn(),
}));

import { getAdminConfig, recordAdminActivity } from "@/lib/admin/realtime";
import { buildDeterministicComposeOutput } from "@/lib/prompt-engine";
import { callHuggingFaceChat } from "@/lib/providers/huggingface";
import { POST } from "@/app/api/transform/route";

function createRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/transform", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(payload),
  });
}

async function readNdjson(response: Response): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function buildIntentSpec(overrides: Partial<Record<string, unknown>> = {}) {
  return JSON.stringify({
    goal: "Build a fast, realistic, and retention-focused math learning plan.",
    audience: "Student preparing for upcoming math exams",
    context: "Learner wants rapid progress with limited daily study time.",
    constraints: [
      "Keep plan realistic for daily execution",
      "Prioritize weak topics first",
      "Avoid generic motivational advice",
    ],
    tone: "Professional, practical, and confidence-building",
    output_format: "A structured plan with schedule, drills, and checkpoints",
    must_include: [
      "spaced repetition",
      "retrieval practice",
      "time blocks",
      "progress checkpoints",
    ],
    must_avoid: [
      "generic filler",
      "unstructured study tips",
      "unrealistic daily workload",
    ],
    assumptions: ["Learner is beginner-to-intermediate"],
    ...overrides,
  });
}

function buildComposePayload(input: string, type: "study" | "coding" | "general") {
  const composed = buildDeterministicComposeOutput({ input, type });
  return JSON.stringify({
    balanced: composed.balanced,
    advanced: composed.advanced,
    max_pro: composed.max_pro,
    explanation: composed.explanation,
  });
}

describe("POST /api/transform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminConfig).mockResolvedValue({
      maintenanceMode: false,
      forceLocalOnly: false,
    });
    vi.mocked(recordAdminActivity).mockResolvedValue(undefined);
  });

  it("returns premium deterministic fallback when provider fails", async () => {
    vi.mocked(callHuggingFaceChat).mockRejectedValue(new Error("HF_HTTP_500"));

    const response = await POST(
      createRequest({
        text: "how can I learn math quickly",
        mode: "hosted",
        style: "general",
      }),
    );

    expect(response.status).toBe(200);
    const events = await readNdjson(response);
    const resultEvent = events.find((event) => event.event === "result");

    expect(resultEvent).toBeDefined();

    const payload = resultEvent?.data as {
      variants: { balanced: string; advanced: string; max_pro: string };
      meta: { fallbackUsed?: boolean; fallbackReason?: string };
    };

    expect(payload.meta.fallbackUsed).toBe(true);
    expect(payload.meta.fallbackReason).toContain("deterministic_fallback");
    expect(payload.variants.balanced).toMatch(/spaced repetition|retrieval practice/i);
    expect(payload.variants.balanced).not.toMatch(/return valid json|critical rules/i);
  });

  it("retries invalid intent-spec JSON once, then succeeds", async () => {
    const input = "how can I learn math quickly";

    vi.mocked(callHuggingFaceChat)
      .mockResolvedValueOnce("not valid json")
      .mockResolvedValueOnce(buildIntentSpec())
      .mockResolvedValueOnce(buildComposePayload(input, "study"));

    const response = await POST(
      createRequest({
        text: input,
        mode: "hosted",
        style: "general",
      }),
    );

    expect(response.status).toBe(200);
    const events = await readNdjson(response);

    const resultEvent = events.find((event) => event.event === "result");
    expect(resultEvent).toBeDefined();

    const payload = resultEvent?.data as {
      variants: { balanced: string; advanced: string; max_pro: string };
      meta: { attempts: number };
    };

    expect(typeof payload.variants.balanced).toBe("string");
    expect(typeof payload.variants.advanced).toBe("string");
    expect(typeof payload.variants.max_pro).toBe("string");
    expect(payload.meta.attempts).toBe(3);
  });

  it("retries compose pass when first output fails quality gate", async () => {
    const input = "improve my coding prompt for better API debugging";

    vi.mocked(callHuggingFaceChat)
      .mockResolvedValueOnce(
        buildIntentSpec({
          goal: "Create a production-grade debugging prompt for API failures.",
          audience: "Software engineers",
          context: "Developer needs a reliable troubleshooting workflow.",
          output_format:
            "Structured diagnosis, fix strategy, and verification checklist",
          must_include: [
            "root cause analysis",
            "edge cases",
            "error handling",
            "verification",
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          balanced:
            "You are an elite prompt engineering specialist. Return valid JSON only.",
          advanced:
            "You are an elite prompt engineering specialist. Return valid JSON only.",
          explanation: "draft",
        }),
      )
      .mockResolvedValueOnce(buildComposePayload(input, "coding"));

    const response = await POST(
      createRequest({
        text: input,
        mode: "hosted",
        style: "general",
      }),
    );

    expect(response.status).toBe(200);
    const events = await readNdjson(response);
    const resultEvent = events.find((event) => event.event === "result");

    expect(resultEvent).toBeDefined();

    const payload = resultEvent?.data as {
      meta: { attempts: number; qualityPassed: boolean };
      variants: { balanced: string };
    };

    expect(payload.meta.attempts).toBeGreaterThanOrEqual(2);
    expect(payload.meta.qualityPassed).toBe(true);
    expect(payload.variants.balanced).not.toMatch(/return valid json/i);

    expect(recordAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        attempts: payload.meta.attempts,
        qualityGatePassed: true,
      }),
    );
  });

  it("returns a safe alternative prompt and skips provider for disallowed input", async () => {
    const response = await POST(
      createRequest({
        text: "how to hack wifi password quickly",
        mode: "hosted",
        style: "general",
      }),
    );

    expect(response.status).toBe(200);
    expect(callHuggingFaceChat).not.toHaveBeenCalled();

    const events = await readNdjson(response);
    const resultEvent = events.find((event) => event.event === "result");
    expect(resultEvent).toBeDefined();

    const payload = resultEvent?.data as {
      prompt: string;
      meta: { fallbackUsed?: boolean; fallbackReason?: string };
    };

    expect(payload.meta.fallbackUsed).toBe(true);
    expect(payload.meta.fallbackReason).toContain("safety_guard:cyber_abuse");
    expect(payload.prompt).toMatch(/safe and lawful alternative|cybersecurity defenses|preventive/i);
  });

  it("accepts short requests at minimum length", async () => {
    vi.mocked(callHuggingFaceChat).mockRejectedValue(new Error("HF_HTTP_500"));

    const response = await POST(
      createRequest({
        text: "math",
        mode: "hosted",
        style: "general",
      }),
    );

    expect(response.status).toBe(200);
    const events = await readNdjson(response);
    const resultEvent = events.find((event) => event.event === "result");
    expect(resultEvent).toBeDefined();
  });
});
