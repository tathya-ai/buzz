import type { RelayEvent } from "@/shared/api/types";

export const DASHBOARD_KIND = 30078;
export const DASHBOARD_TAG = "buzz-dashboard";
export const DASHBOARD_D_PREFIX = "buzz-dashboard:";

export type DashboardMetric = {
  label: string;
  path: string;
  suffix?: string;
};

export type DashboardPanel = {
  id: string;
  title: string;
  source: { dTag: string; author?: "owner" | string };
  type: "metrics" | "text" | "list" | "json";
  path?: string;
  emptyText?: string;
  metrics?: DashboardMetric[];
  itemTitlePath?: string;
  itemBodyPath?: string;
  limit?: number;
};

export type DashboardManifest = {
  version: 1;
  slug: string;
  title: string;
  description?: string;
  panels: DashboardPanel[];
};

export type DashboardDefinition = {
  event: RelayEvent;
  manifest: DashboardManifest;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shortText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function safePath(value: unknown): string | null {
  const path = shortText(value, 160);
  if (!path || !/^[A-Za-z0-9_.-]+$/.test(path)) return null;
  return path;
}

function safeAuthor(value: unknown): "owner" | string | null {
  if (value === "owner") return value;
  if (typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) return value;
  return null;
}

function parseMetric(value: unknown): DashboardMetric | null {
  if (!isRecord(value)) return null;
  const label = shortText(value.label, 80);
  const path = safePath(value.path);
  const suffix =
    value.suffix === undefined ? undefined : shortText(value.suffix, 24);
  if (!label || !path || (value.suffix !== undefined && suffix === null)) {
    return null;
  }
  return { label, path, ...(suffix ? { suffix } : {}) };
}

function parsePanel(value: unknown): DashboardPanel | null {
  if (!isRecord(value) || !isRecord(value.source)) return null;
  const id = shortText(value.id, 80);
  const title = shortText(value.title, 120);
  const dTag = shortText(value.source.dTag, 200);
  const author =
    value.source.author === undefined
      ? undefined
      : safeAuthor(value.source.author);
  const type = value.type;
  if (
    !id ||
    !title ||
    !dTag ||
    !["metrics", "text", "list", "json"].includes(String(type)) ||
    (value.source.author !== undefined && author === null)
  ) {
    return null;
  }

  const panel: DashboardPanel = {
    id,
    title,
    source: { dTag, ...(author ? { author } : {}) },
    type: type as DashboardPanel["type"],
  };
  const path = value.path === undefined ? undefined : safePath(value.path);
  if (value.path !== undefined && path === null) return null;
  if (path) panel.path = path;

  const emptyText =
    value.emptyText === undefined ? undefined : shortText(value.emptyText, 160);
  if (value.emptyText !== undefined && emptyText === null) return null;
  if (emptyText) panel.emptyText = emptyText;

  if (panel.type === "metrics") {
    if (!Array.isArray(value.metrics) || value.metrics.length === 0)
      return null;
    const metrics = value.metrics.slice(0, 12).map(parseMetric);
    if (metrics.some((metric) => metric === null)) return null;
    panel.metrics = metrics as DashboardMetric[];
  }

  if (panel.type === "list") {
    const itemTitlePath = safePath(value.itemTitlePath);
    const itemBodyPath =
      value.itemBodyPath === undefined
        ? undefined
        : safePath(value.itemBodyPath);
    if (!panel.path || !itemTitlePath) return null;
    if (value.itemBodyPath !== undefined && itemBodyPath === null) return null;
    panel.itemTitlePath = itemTitlePath;
    if (itemBodyPath) panel.itemBodyPath = itemBodyPath;
    if (value.limit !== undefined) {
      if (!Number.isInteger(value.limit) || Number(value.limit) < 1)
        return null;
      panel.limit = Math.min(Number(value.limit), 50);
    }
  }

  if (panel.type === "text" && !panel.path) return null;
  return panel;
}

export function parseDashboardManifest(
  event: RelayEvent,
): DashboardManifest | null {
  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
  const hasDashboardTag = event.tags.some(
    (tag) => tag[0] === "t" && tag[1] === DASHBOARD_TAG,
  );
  if (
    event.kind !== DASHBOARD_KIND ||
    !dTag?.startsWith(DASHBOARD_D_PREFIX) ||
    !hasDashboardTag
  ) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(event.content);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.panels)) {
    return null;
  }
  const slug = shortText(value.slug, 80);
  const title = shortText(value.title, 120);
  const description =
    value.description === undefined
      ? undefined
      : shortText(value.description, 300);
  if (!slug || !title || (value.description !== undefined && !description)) {
    return null;
  }
  const panels = value.panels.slice(0, 24).map(parsePanel);
  if (panels.length === 0 || panels.some((panel) => panel === null)) {
    return null;
  }
  return {
    version: 1,
    slug,
    title,
    ...(description ? { description } : {}),
    panels: panels as DashboardPanel[],
  };
}

export function selectDashboardDefinitions(
  events: RelayEvent[],
  ownerPubkey: string,
): DashboardDefinition[] {
  const owner = ownerPubkey.toLowerCase();
  const latest = new Map<string, DashboardDefinition>();
  for (const event of events) {
    if (event.pubkey.toLowerCase() !== owner) continue;
    const manifest = parseDashboardManifest(event);
    if (!manifest) continue;
    const current = latest.get(manifest.slug);
    if (
      !current ||
      event.created_at > current.event.created_at ||
      (event.created_at === current.event.created_at &&
        event.id > current.event.id)
    ) {
      latest.set(manifest.slug, { event, manifest });
    }
  }
  return [...latest.values()].sort((left, right) =>
    left.manifest.title.localeCompare(right.manifest.title),
  );
}

export function latestRecordsByDTag(
  events: RelayEvent[],
  allowedAuthorsByDTag?: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, RelayEvent> {
  const latest = new Map<string, RelayEvent>();
  for (const event of events) {
    const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
    if (!dTag) continue;
    const allowedAuthors = allowedAuthorsByDTag?.get(dTag);
    if (allowedAuthors && !allowedAuthors.has(event.pubkey.toLowerCase())) {
      continue;
    }
    const current = latest.get(dTag);
    if (
      !current ||
      event.created_at > current.created_at ||
      (event.created_at === current.created_at && event.id > current.id)
    ) {
      latest.set(dTag, event);
    }
  }
  return latest;
}

export function parseRecordContent(event: RelayEvent | undefined): unknown {
  if (!event) return undefined;
  try {
    return JSON.parse(event.content);
  } catch {
    return event.content;
  }
}

export function readDashboardPath(value: unknown, path?: string): unknown {
  if (!path) return value;
  let current = value;
  for (const segment of path.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function displayDashboardValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}
