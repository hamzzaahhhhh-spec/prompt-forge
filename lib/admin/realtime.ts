import type {
  AdminActivity,
  AdminConfig,
  AdminMetrics,
  AdminMode,
  AdminSnapshot,
  AdminStyle,
} from "@/lib/admin/types";
import type { PromptType } from "@/lib/types";

type RecordActivityInput = {
  requestedMode: AdminMode;
  effectiveMode: AdminMode;
  style: AdminStyle;
  status: AdminActivity["status"];
  latencyMs: number;
  fallbackUsed?: boolean;
  score?: number;
  type?: PromptType;
  errorCode?: string;
};

type AdminStore = {
  config: AdminConfig;
  activities: AdminActivity[];
};

const MAX_RECENT = 120;

const defaultConfig: AdminConfig = {
  maintenanceMode: false,
  forceLocalOnly: false,
};

const globalAdmin = globalThis as typeof globalThis & {
  __promptForgeAdminStore?: AdminStore;
};

function getStore(): AdminStore {
  if (!globalAdmin.__promptForgeAdminStore) {
    globalAdmin.__promptForgeAdminStore = {
      config: { ...defaultConfig },
      activities: [],
    };
  }

  return globalAdmin.__promptForgeAdminStore;
}

export function getAdminConfig(): AdminConfig {
  return { ...getStore().config };
}

export function updateAdminConfig(next: Partial<AdminConfig>): AdminConfig {
  const store = getStore();
  store.config = {
    ...store.config,
    ...next,
  };
  return { ...store.config };
}

export function recordAdminActivity(input: RecordActivityInput): void {
  const store = getStore();
  const now = Date.now();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2)}`;

  const entry: AdminActivity = {
    id,
    timestamp: now,
    requestedMode: input.requestedMode,
    effectiveMode: input.effectiveMode,
    style: input.style,
    status: input.status,
    latencyMs: input.latencyMs,
    fallbackUsed: Boolean(input.fallbackUsed),
    score: input.score,
    type: input.type,
    errorCode: input.errorCode,
  };

  store.activities.unshift(entry);
  if (store.activities.length > MAX_RECENT) {
    store.activities = store.activities.slice(0, MAX_RECENT);
  }
}

function buildMetrics(activities: AdminActivity[]): AdminMetrics {
  const oneMinuteAgo = Date.now() - 60_000;

  const totalRequests = activities.length;
  const successRequests = activities.filter((item) => item.status === "success").length;
  const failedRequests = activities.filter((item) => item.status === "failed").length;
  const rateLimitedRequests = activities.filter((item) => item.status === "rate_limited").length;
  const blockedRequests = activities.filter((item) => item.status === "blocked").length;
  const fallbackCount = activities.filter((item) => item.fallbackUsed).length;
  const requestsLastMinute = activities.filter((item) => item.timestamp >= oneMinuteAgo).length;

  return {
    totalRequests,
    successRequests,
    failedRequests,
    rateLimitedRequests,
    blockedRequests,
    fallbackCount,
    requestsLastMinute,
  };
}

export function getAdminSnapshot(): AdminSnapshot {
  const store = getStore();
  const recentActivities = store.activities.slice(0, 40);

  return {
    generatedAt: Date.now(),
    config: { ...store.config },
    metrics: buildMetrics(store.activities),
    recentActivities,
    security: {
      logsContainRawContent: false,
      requiresAdminKey: true,
      transformSystemPromptLocked: true,
    },
  };
}
