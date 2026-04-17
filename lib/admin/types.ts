import type { InferenceProvider, PromptType } from "@/lib/types";

export type AdminMode = "local" | "hosted" | "unknown";
export type AdminStyle = "general" | "unknown";

export type AdminActivityStatus =
  | "success"
  | "failed"
  | "rate_limited"
  | "blocked";

export type AdminActivity = {
  id: string;
  timestamp: number;
  requestedMode: AdminMode;
  effectiveMode: AdminMode;
  style: AdminStyle;
  status: AdminActivityStatus;
  latencyMs: number;
  score?: number;
  qualityScore?: number;
  qualityGatePassed?: boolean;
  qualityIssues?: string[];
  provider?: InferenceProvider;
  attempts?: number;
  inferenceMs?: number;
  type?: PromptType;
  errorCode?: string;
};

export type AdminConfig = {
  maintenanceMode: boolean;
  forceLocalOnly: boolean;
};

export type AdminMetrics = {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  blockedRequests: number;
  qualityRejectedCount: number;
  inferenceUnavailableCount: number;
  requestsLastMinute: number;
};

export type AdminSnapshot = {
  generatedAt: number;
  config: AdminConfig;
  metrics: AdminMetrics;
  recentActivities: AdminActivity[];
  security: {
    logsContainRawContent: false;
    requiresAdminKey: true;
    transformSystemPromptLocked: true;
    activityStorage: "kv" | "blob" | "memory";
    crossInstanceReliable: boolean;
  };
};
