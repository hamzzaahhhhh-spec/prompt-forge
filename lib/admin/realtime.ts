import { list as listBlob, put as putBlob } from "@vercel/blob";

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

type KvSettings = {
  url: string;
  token: string;
};

type BlobSettings = {
  token: string;
};

type KvPipelineResult = {
  result?: unknown;
  error?: string;
};

const MAX_RECENT = 120;
const MAX_RECENT_FOR_DASHBOARD = 40;
const DEFAULT_ACTIVITY_KEY = "promptforge:admin:activity";
const DEFAULT_CONFIG_KEY = "promptforge:admin:config";
const DEFAULT_BLOB_ACTIVITY_PATH = "admin/activity.json";
const DEFAULT_BLOB_CONFIG_PATH = "admin/config.json";

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

function getKvSettings(): KvSettings | null {
  const url = process.env.KV_REST_API_URL?.trim();
  const token = process.env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
  };
}

function getBlobSettings(): BlobSettings | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return null;
  }

  return { token };
}

function getActivityKey(): string {
  return process.env.ADMIN_ACTIVITY_KV_KEY?.trim() || DEFAULT_ACTIVITY_KEY;
}

function getConfigKey(): string {
  return process.env.ADMIN_CONFIG_KV_KEY?.trim() || DEFAULT_CONFIG_KEY;
}

function getBlobActivityPath(): string {
  return process.env.ADMIN_ACTIVITY_BLOB_PATH?.trim() || DEFAULT_BLOB_ACTIVITY_PATH;
}

function getBlobConfigPath(): string {
  return process.env.ADMIN_CONFIG_BLOB_PATH?.trim() || DEFAULT_BLOB_CONFIG_PATH;
}

async function runKvPipeline(commands: string[][]): Promise<KvPipelineResult[] | null> {
  const kv = getKvSettings();
  if (!kv) {
    return null;
  }

  try {
    const response = await fetch(`${kv.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kv.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as KvPipelineResult[];
  } catch {
    return null;
  }
}

function createActivityEntry(input: RecordActivityInput): AdminActivity {
  const now = Date.now();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2)}`;

  return {
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
}

function isAdminActivity(candidate: unknown): candidate is AdminActivity {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const entry = candidate as Partial<AdminActivity>;
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "number" &&
    typeof entry.requestedMode === "string" &&
    typeof entry.effectiveMode === "string" &&
    typeof entry.style === "string" &&
    typeof entry.status === "string" &&
    typeof entry.latencyMs === "number" &&
    typeof entry.fallbackUsed === "boolean"
  );
}

async function readKvConfig(): Promise<AdminConfig | null> {
  const response = await runKvPipeline([["GET", getConfigKey()]]);
  const payload = response?.[0]?.result;
  if (typeof payload !== "string" || payload.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<AdminConfig>;
    if (
      typeof parsed.maintenanceMode === "boolean" &&
      typeof parsed.forceLocalOnly === "boolean"
    ) {
      return {
        maintenanceMode: parsed.maintenanceMode,
        forceLocalOnly: parsed.forceLocalOnly,
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function writeKvConfig(config: AdminConfig): Promise<boolean> {
  const response = await runKvPipeline([["SET", getConfigKey(), JSON.stringify(config)]]);
  return Array.isArray(response);
}

async function readKvActivities(limit: number): Promise<AdminActivity[] | null> {
  const cappedLimit = Math.max(1, Math.min(limit, MAX_RECENT));
  const response = await runKvPipeline([["LRANGE", getActivityKey(), "0", String(cappedLimit - 1)]]);
  const payload = response?.[0]?.result;

  if (!Array.isArray(payload)) {
    return null;
  }

  const parsed: AdminActivity[] = [];
  for (const item of payload) {
    if (typeof item !== "string") {
      continue;
    }

    try {
      const activity = JSON.parse(item) as unknown;
      if (isAdminActivity(activity)) {
        parsed.push(activity);
      }
    } catch {
      continue;
    }
  }

  return parsed;
}

async function appendKvActivity(entry: AdminActivity): Promise<boolean> {
  const response = await runKvPipeline([
    ["LPUSH", getActivityKey(), JSON.stringify(entry)],
    ["LTRIM", getActivityKey(), "0", String(MAX_RECENT - 1)],
  ]);

  return Array.isArray(response);
}

async function readBlobJson(pathname: string): Promise<unknown | null> {
  const blob = getBlobSettings();
  if (!blob) {
    return null;
  }

  try {
    const found = await listBlob({
      token: blob.token,
      prefix: pathname,
      limit: 10,
    });

    const target = found.blobs.find((item) => item.pathname === pathname);
    if (!target) {
      return null;
    }

    const response = await fetch(`${target.url}?t=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function writeBlobJson(pathname: string, payload: unknown): Promise<boolean> {
  const blob = getBlobSettings();
  if (!blob) {
    return false;
  }

  try {
    await putBlob(pathname, JSON.stringify(payload), {
      access: "public",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });

    return true;
  } catch {
    return false;
  }
}

async function readBlobConfig(): Promise<AdminConfig | null> {
  const payload = await readBlobJson(getBlobConfigPath());
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const parsed = payload as Partial<AdminConfig>;
  if (
    typeof parsed.maintenanceMode === "boolean" &&
    typeof parsed.forceLocalOnly === "boolean"
  ) {
    return {
      maintenanceMode: parsed.maintenanceMode,
      forceLocalOnly: parsed.forceLocalOnly,
    };
  }

  return null;
}

async function writeBlobConfig(config: AdminConfig): Promise<boolean> {
  return writeBlobJson(getBlobConfigPath(), config);
}

async function readBlobActivities(limit: number): Promise<AdminActivity[] | null> {
  const payload = await readBlobJson(getBlobActivityPath());
  if (!Array.isArray(payload)) {
    return null;
  }

  const valid = payload.filter(isAdminActivity);
  const cappedLimit = Math.max(1, Math.min(limit, MAX_RECENT));
  return valid.slice(0, cappedLimit);
}

async function writeBlobActivities(activities: AdminActivity[]): Promise<boolean> {
  return writeBlobJson(getBlobActivityPath(), activities.slice(0, MAX_RECENT));
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const store = getStore();
  const kvConfig = await readKvConfig();

  if (kvConfig) {
    store.config = { ...kvConfig };
    return { ...kvConfig };
  }

  const blobConfig = await readBlobConfig();
  if (blobConfig) {
    store.config = { ...blobConfig };
    return { ...blobConfig };
  }

  return { ...store.config };
}

export async function updateAdminConfig(next: Partial<AdminConfig>): Promise<AdminConfig> {
  const store = getStore();

  const currentConfig = await getAdminConfig();
  store.config = {
    ...currentConfig,
    ...next,
  };

  const wroteKv = getKvSettings() ? await writeKvConfig(store.config) : false;
  if (!wroteKv) {
    await writeBlobConfig(store.config);
  }

  return { ...store.config };
}

export async function recordAdminActivity(input: RecordActivityInput): Promise<void> {
  const store = getStore();
  const entry = createActivityEntry(input);

  store.activities.unshift(entry);
  if (store.activities.length > MAX_RECENT) {
    store.activities = store.activities.slice(0, MAX_RECENT);
  }

  const wroteKv = getKvSettings() ? await appendKvActivity(entry) : false;
  if (wroteKv) {
    return;
  }

  if (!getBlobSettings()) {
    return;
  }

  const blobActivities = await readBlobActivities(MAX_RECENT);
  const merged = [entry, ...(blobActivities ?? store.activities)].slice(0, MAX_RECENT);
  store.activities = merged;
  await writeBlobActivities(merged);
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

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const store = getStore();

  const config = await getAdminConfig();
  let activityStorage: AdminSnapshot["security"]["activityStorage"] = "memory";
  let activities: AdminActivity[] = store.activities;

  if (getKvSettings()) {
    const kvActivities = await readKvActivities(MAX_RECENT);
    if (kvActivities) {
      activities = kvActivities;
      activityStorage = "kv";
    }
  }

  if (activityStorage === "memory" && getBlobSettings()) {
    const blobActivities = await readBlobActivities(MAX_RECENT);
    if (blobActivities) {
      activities = blobActivities;
      activityStorage = "blob";
    }
  }

  store.activities = activities.slice(0, MAX_RECENT);

  const recentActivities = activities.slice(0, MAX_RECENT_FOR_DASHBOARD);

  return {
    generatedAt: Date.now(),
    config,
    metrics: buildMetrics(activities),
    recentActivities,
    security: {
      logsContainRawContent: false,
      requiresAdminKey: true,
      transformSystemPromptLocked: true,
      activityStorage,
      crossInstanceReliable: activityStorage !== "memory",
    },
  };
}
