import { apiCallCounter } from "./api-call-counter";

type Labels = Record<string, string>;

type CounterPoint = {
  labels: Labels;
  value: number;
};

type HistogramPoint = {
  labels: Labels;
  buckets: number[];
  count: number;
  sum: number;
};

const REQUEST_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];
const STATUS_PROBE_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];
const RENDER_DURATION_BUCKETS_MS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];
const API_PATH_PREFIXES = ["/avatars", "/renders", "/skins", "/capes", "/players", "/status", "/format", "/api"];
const API_PATH_EXCLUDED_PREFIXES = ["/metrics/api-calls"];

function normalizeLabelValue(value: unknown): string {
  return String(value ?? "");
}

function labelsKey(labels: Labels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}

function encodeLabelValue(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll('"', '\\"');
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    return "";
  }

  const body = entries
    .map(([key, value]) => `${key}="${encodeLabelValue(value)}"`)
    .join(",");
  return `{${body}}`;
}

function clampNonNegativeFinite(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function incCounter(store: Map<string, CounterPoint>, labels: Labels, amount = 1): void {
  const key = labelsKey(labels);
  const current = store.get(key);
  if (current) {
    current.value += amount;
    return;
  }

  store.set(key, {
    labels,
    value: amount,
  });
}

function observeHistogram(
  store: Map<string, HistogramPoint>,
  bucketUpperBounds: number[],
  labels: Labels,
  value: number,
): void {
  const observed = clampNonNegativeFinite(value);
  const key = labelsKey(labels);
  const current = store.get(key);
  const point = current || {
    labels,
    buckets: Array.from({ length: bucketUpperBounds.length }, () => 0),
    count: 0,
    sum: 0,
  };

  for (let i = 0; i < bucketUpperBounds.length; i += 1) {
    if (observed <= bucketUpperBounds[i]) {
      point.buckets[i] += 1;
    }
  }

  point.count += 1;
  point.sum += observed;
  store.set(key, point);
}

function normalizeRequestPath(path: string): string {
  const pathname = String(path || "/").split("?")[0] || "/";
  return pathname
    .replace(/\/[0-9a-f]{32,36}(?=\/|\.|$)/gi, "/:id")
    .replace(/\/\d{2,6}(?=\/|$)/g, "/:num")
    .replace(/\/(?:head|body)\/:id$/i, "/:renderType/:id");
}

function isApiPath(path: string): boolean {
  if (API_PATH_EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  return API_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function serializeCounterMetric(name: string, store: Map<string, CounterPoint>): string[] {
  const lines: string[] = [];
  for (const point of store.values()) {
    lines.push(`${name}${formatLabels(point.labels)} ${point.value}`);
  }
  return lines;
}

function serializeHistogramMetric(
  name: string,
  bucketUpperBounds: number[],
  store: Map<string, HistogramPoint>,
): string[] {
  const lines: string[] = [];
  for (const point of store.values()) {
    for (let i = 0; i < bucketUpperBounds.length; i += 1) {
      lines.push(`${name}_bucket${formatLabels({ ...point.labels, le: String(bucketUpperBounds[i]) })} ${point.buckets[i]}`);
    }
    lines.push(`${name}_bucket${formatLabels({ ...point.labels, le: "+Inf" })} ${point.count}`);
    lines.push(`${name}_sum${formatLabels(point.labels)} ${Number(point.sum.toFixed(3))}`);
    lines.push(`${name}_count${formatLabels(point.labels)} ${point.count}`);
  }
  return lines;
}

class MetricsRegistry {
  private readonly bootedAt = Date.now();
  private readonly requestsTotal = new Map<string, CounterPoint>();
  private readonly requestsNon2xxTotal = new Map<string, CounterPoint>();
  private readonly requestDurationMs = new Map<string, HistogramPoint>();

  private readonly statusProbeCacheEventsTotal = new Map<string, CounterPoint>();
  private readonly statusProbeDurationMs = new Map<string, HistogramPoint>();

  private readonly renderEventsTotal = new Map<string, CounterPoint>();
  private readonly renderDurationMs = new Map<string, HistogramPoint>();

  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    const labels = {
      method: String(method || "GET").toUpperCase(),
      path: normalizeRequestPath(path),
      status: String(statusCode),
    };
    incCounter(this.requestsTotal, labels);

    observeHistogram(
      this.requestDurationMs,
      REQUEST_DURATION_BUCKETS_MS,
      {
        method: labels.method,
        path: labels.path,
      },
      durationMs,
    );

    if (statusCode < 200 || statusCode >= 300) {
      incCounter(this.requestsNon2xxTotal, {
        method: labels.method,
        path: labels.path,
      });
    }

    if (isApiPath(labels.path)) {
      apiCallCounter.recordApiCall();
    }
  }

  getApiCallCount(): number {
    return apiCallCounter.getTotal();
  }

  recordStatusProbeCache(route: string, result: "hit" | "miss" | "inflight"): void {
    incCounter(this.statusProbeCacheEventsTotal, {
      route: normalizeLabelValue(route),
      result: normalizeLabelValue(result),
    });
  }

  recordStatusProbeDuration(route: string, outcome: "success" | "error", durationMs: number): void {
    observeHistogram(
      this.statusProbeDurationMs,
      STATUS_PROBE_DURATION_BUCKETS_MS,
      {
        route: normalizeLabelValue(route),
        outcome: normalizeLabelValue(outcome),
      },
      durationMs,
    );
  }

  recordRender(type: string, source: "cache" | "generated" | "stale", outcome: "success" | "error"): void {
    incCounter(this.renderEventsTotal, {
      type: normalizeLabelValue(type),
      source: normalizeLabelValue(source),
      outcome: normalizeLabelValue(outcome),
    });
  }

  recordRenderDuration(
    type: string,
    source: "cache" | "generated" | "stale",
    outcome: "success" | "error",
    durationMs: number,
  ): void {
    observeHistogram(
      this.renderDurationMs,
      RENDER_DURATION_BUCKETS_MS,
      {
        type: normalizeLabelValue(type),
        source: normalizeLabelValue(source),
        outcome: normalizeLabelValue(outcome),
      },
      durationMs,
    );
  }

  private statusProbeHitRateLines(): string[] {
    const totalsByRoute = new Map<string, { hit: number; miss: number }>();

    for (const point of this.statusProbeCacheEventsTotal.values()) {
      const route = point.labels.route || "unknown";
      const result = point.labels.result || "miss";
      const current = totalsByRoute.get(route) || { hit: 0, miss: 0 };
      if (result === "hit") {
        current.hit += point.value;
      } else if (result === "miss") {
        current.miss += point.value;
      }
      totalsByRoute.set(route, current);
    }

    const lines: string[] = [];
    for (const [route, values] of totalsByRoute.entries()) {
      const denominator = values.hit + values.miss;
      const rate = denominator > 0 ? values.hit / denominator : 0;
      lines.push(`nitrocraft_status_probe_cache_hit_ratio{route="${encodeLabelValue(route)}"} ${Number(rate.toFixed(6))}`);
    }
    return lines;
  }

  toPrometheusText(): string {
    const uptimeSeconds = Math.max(0, (Date.now() - this.bootedAt) / 1000);
    const lines: string[] = [
      "# HELP nitrocraft_uptime_seconds Process uptime in seconds.",
      "# TYPE nitrocraft_uptime_seconds gauge",
      `nitrocraft_uptime_seconds ${Number(uptimeSeconds.toFixed(3))}`,
      "",
      "# HELP nitrocraft_http_requests_total Total HTTP responses emitted by NitroCraft.",
      "# TYPE nitrocraft_http_requests_total counter",
      ...serializeCounterMetric("nitrocraft_http_requests_total", this.requestsTotal),
      "",
      "# HELP nitrocraft_http_request_non_2xx_total Total non-2xx HTTP responses.",
      "# TYPE nitrocraft_http_request_non_2xx_total counter",
      ...serializeCounterMetric("nitrocraft_http_request_non_2xx_total", this.requestsNon2xxTotal),
      "",
      "# HELP nitrocraft_http_request_duration_ms HTTP response duration in milliseconds.",
      "# TYPE nitrocraft_http_request_duration_ms histogram",
      ...serializeHistogramMetric("nitrocraft_http_request_duration_ms", REQUEST_DURATION_BUCKETS_MS, this.requestDurationMs),
      "",
      "# HELP nitrocraft_status_probe_cache_events_total Cache events for /status probe routes.",
      "# TYPE nitrocraft_status_probe_cache_events_total counter",
      ...serializeCounterMetric("nitrocraft_status_probe_cache_events_total", this.statusProbeCacheEventsTotal),
      "",
      "# HELP nitrocraft_status_probe_cache_hit_ratio Ratio of cache hits over misses by status route.",
      "# TYPE nitrocraft_status_probe_cache_hit_ratio gauge",
      ...this.statusProbeHitRateLines(),
      "",
      "# HELP nitrocraft_status_probe_duration_ms Upstream probe duration in milliseconds.",
      "# TYPE nitrocraft_status_probe_duration_ms histogram",
      ...serializeHistogramMetric("nitrocraft_status_probe_duration_ms", STATUS_PROBE_DURATION_BUCKETS_MS, this.statusProbeDurationMs),
      "",
      "# HELP nitrocraft_render_events_total Render events grouped by source/outcome.",
      "# TYPE nitrocraft_render_events_total counter",
      ...serializeCounterMetric("nitrocraft_render_events_total", this.renderEventsTotal),
      "",
      "# HELP nitrocraft_render_duration_ms Render pipeline duration in milliseconds.",
      "# TYPE nitrocraft_render_duration_ms histogram",
      ...serializeHistogramMetric("nitrocraft_render_duration_ms", RENDER_DURATION_BUCKETS_MS, this.renderDurationMs),
    ];

    return lines.join("\n").trimEnd() + "\n";
  }
}

export const metrics = new MetricsRegistry();
