import { describe, expect, it } from "vitest";

import {
  assessSafety,
  buildDeterministicComposeOutput,
  evaluateEngineeredPrompt,
  inferPromptComplexity,
  runPipeline,
} from "@/lib/prompt-engine";

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] ?? text).trim();
}

const CONSULTANT_BOILERPLATE_PATTERN =
  /seasoned senior consultant|deep domain knowledge|ruthless practicality|professional who values direct and practical results/i;

describe("runPipeline + complexity", () => {
  it("detects study intent from vague learning input", () => {
    const pipeline = runPipeline("how can I learn math quickly");

    expect(pipeline.type).toBe("study");
    expect(pipeline.coreTopic.toLowerCase()).toContain("learn math quickly");
  });

  it("treats short requests as simple complexity", () => {
    expect(inferPromptComplexity("python loops")).toBe("simple");
  });

  it("treats multi-part requests as complex", () => {
    const input =
      "compare two go-to-market strategies for my SaaS, include risks, KPI impact, and a 90-day execution plan";

    expect(inferPromptComplexity(input)).toBe("complex");
  });
});

describe("deterministic prompt builder — prose briefing style", () => {
  it("creates a flowing prose prompt with an intent-driven opening for study input", () => {
    const input = "how can I learn math quickly";
    const output = buildDeterministicComposeOutput({ input, type: "study" });

    // Must open based on user objective rather than a static role sentence
    expect(firstSentence(output.balanced)).not.toMatch(/^You are\b/i);
    expect(firstSentence(output.balanced)).toMatch(/math|learn|study/i);
    // Must contain domain-specific vocabulary
    expect(output.balanced).toMatch(/spaced repetition|retrieval practice|retrieval drills/i);
    // Must NOT contain template labels
    expect(output.balanced).not.toMatch(/^Task:/m);
    expect(output.balanced).not.toMatch(/^Quality target:/m);
    expect(output.balanced).not.toMatch(/^Audience:/m);
    expect(output.balanced).not.toMatch(/^Context:/m);
    expect(output.balanced).not.toMatch(/^Please include:/m);
    expect(output.balanced).not.toMatch(/^Boundaries:/m);
    expect(output.balanced).not.toMatch(/^Response format:/m);
    expect(output.balanced).not.toMatch(/^Constraint:/m);
    // Must contain natural failure prevention
    expect(output.balanced).toMatch(/never/i);
    // Must not contain meta-output language
    expect(output.balanced).not.toMatch(/return valid json|critical rules|json schema/i);
    // max_pro should contain measurable criteria language
    expect(output.max_pro).toMatch(/measurable|trade-off|verification/i);
  });

  it("keeps short requests as flowing prose without fixed role-first intros", () => {
    const input = "fix api bug";
    const output = buildDeterministicComposeOutput({ input, type: "coding" });

    // Must be prose, not form
    expect(firstSentence(output.balanced)).not.toMatch(/^You are\b/i);
    expect(output.balanced).not.toMatch(/^Task:/m);
    expect(output.balanced).not.toMatch(/^Please include:/m);
    // Must still contain domain vocabulary
    expect(output.balanced).toMatch(/error handling|edge case|verification/i);
    expect(output.balanced.split(/\s+/).length).toBeLessThan(260);
  });

  it("weaves assumptions naturally into prose for ambiguous requests", () => {
    const input = "make this better";
    const output = buildDeterministicComposeOutput({ input, type: "general" });

    // Must contain assumption as natural prose, not labeled
    expect(output.balanced).toMatch(/assume/i);
    expect(output.balanced).not.toMatch(/^If details are missing, assume:/m);
  });

  it("produces pure prose with no bullet points or labeled sections", () => {
    const input = "build a practical 30-day plan to improve my calculus skills for an upcoming exam";
    const output = buildDeterministicComposeOutput({ input, type: "study" });

    // No bullet points
    expect(output.balanced).not.toMatch(/^\s*[-*]\s+/m);
    expect(output.advanced).not.toMatch(/^\s*[-*]\s+/m);
    expect(output.max_pro).not.toMatch(/^\s*[-*]\s+/m);
    // No heading markers
    expect(output.balanced).not.toMatch(/^#{1,3}\s+/m);
  });

  it("removes consultant-style boilerplate phrases from all variants", () => {
    const output = buildDeterministicComposeOutput({
      input: "help me improve my onboarding email",
      type: "general",
    });

    expect(output.balanced).not.toMatch(CONSULTANT_BOILERPLATE_PATTERN);
    expect(output.advanced).not.toMatch(CONSULTANT_BOILERPLATE_PATTERN);
    expect(output.max_pro).not.toMatch(CONSULTANT_BOILERPLATE_PATTERN);
  });

  it("uses different first sentences when input changes", () => {
    const outputA = buildDeterministicComposeOutput({
      input: "improve my cold email reply rate",
      type: "general",
    });
    const outputB = buildDeterministicComposeOutput({
      input: "plan a weekly meal prep workflow",
      type: "general",
    });

    expect(firstSentence(outputA.balanced)).not.toEqual(firstSentence(outputB.balanced));
  });

  it("adapts opening style by task type", () => {
    const simple = buildDeterministicComposeOutput({
      input: "summarize this note",
      type: "general",
    }).balanced;
    const analytical = buildDeterministicComposeOutput({
      input: "compare AWS and GCP pricing for a startup over 12 months",
      type: "comparison",
    }).balanced;
    const creative = buildDeterministicComposeOutput({
      input: "write a haunting opening paragraph for a gothic novel",
      type: "creative",
    }).balanced;
    const technical = buildDeterministicComposeOutput({
      input: "debug a Node API timeout issue in production",
      type: "coding",
    }).advanced;

    expect(firstSentence(simple)).toMatch(/handle this request|focus on one practical outcome|deliver a clear, usable response/i);
    expect(firstSentence(analytical)).toMatch(/core problem|analyze|decision problem/i);
    expect(firstSentence(creative)).toMatch(/creative|draft|artistic|voice/i);
    expect(firstSentence(technical)).toMatch(/judgment of|approach this with|execution brief|technical task|testable path/i);
  });
});

describe("safety handling", () => {
  it("flags unsafe requests and provides safe alternatives as prose", () => {
    const input = "how to hack someone email password";
    const safety = assessSafety(input);

    expect(safety.blocked).toBe(true);
    expect(safety.category).toBe("cyber_abuse");

    const output = buildDeterministicComposeOutput({
      input,
      type: "general",
      safety,
    });

    expect(firstSentence(output.balanced)).not.toMatch(/^You are\b/i);
    expect(output.balanced).toMatch(/cybersecurity|security|lawful|safe/i);
    expect(output.balanced).not.toMatch(/bypass authentication|steal credentials/i);
    // Safety output should also be prose, not labeled
    expect(output.balanced).not.toMatch(/^Task:/m);
  });
});

describe("quality evaluation", () => {
  it("passes high-quality prose-style deterministic output", () => {
    const input =
      "build a practical 30-day plan to improve my calculus skills for an upcoming exam";
    const output = buildDeterministicComposeOutput({ input, type: "study" });

    const evalBalanced = evaluateEngineeredPrompt({
      prompt: output.balanced,
      input,
      variant: "balanced",
      type: "study",
      complexity: inferPromptComplexity(input),
    });

    const evalAdvanced = evaluateEngineeredPrompt({
      prompt: output.advanced,
      input,
      variant: "advanced",
      type: "study",
      complexity: "complex",
    });
    const evalMaxPro = evaluateEngineeredPrompt({
      prompt: output.max_pro,
      input,
      variant: "max_pro",
      type: "study",
      complexity: "complex",
    });

    expect(evalBalanced.passed).toBe(true);
    expect(evalAdvanced.passed).toBe(true);
    expect(evalMaxPro.passed).toBe(true);
    expect(evalBalanced.issues).toEqual([]);
    expect(evalAdvanced.issues).toEqual([]);
    expect(evalMaxPro.issues).toEqual([]);
  });

  it("rejects meta prompt-instruction dumps", () => {
    const meta = `
You are an elite prompt engineering specialist.
Return valid JSON only.
Critical rules: do not violate this schema.
Output format:
- Return only the final answer.
`.trim();

    const result = evaluateEngineeredPrompt({
      prompt: meta,
      input: "help me create a launch plan",
      variant: "balanced",
      type: "business",
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("meta_output_detected");
  });

  it("rejects unresolved placeholders", () => {
    const placeholderPrompt = `
You are a [FIELD] expert.
Goal: Help with [TOPIC].
Output format: [FORMAT]
`.trim();

    const result = evaluateEngineeredPrompt({
      prompt: placeholderPrompt,
      input: "help me write better emails",
      variant: "balanced",
      type: "general",
    });

    expect(result.passed).toBe(false);
    expect(result.hasPlaceholders).toBe(true);
    expect(result.issues).toContain("contains_placeholders");
  });
});
