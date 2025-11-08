/**
 * Enterprise Metrics and Telemetry System
 *
 * Provides comprehensive metrics collection for monitoring and observability.
 * Compatible with Prometheus and other monitoring systems.
 */

import { getConfig } from "./config-manager";

/**
 * Metric types
 */
export type MetricType = "counter" | "gauge" | "histogram" | "summary";

/**
 * Metric data structure
 */
interface Metric {
  name: string;
  type: MetricType;
  help: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

/**
 * Histogram bucket for latency tracking
 */
interface HistogramBucket {
  le: number; // Less than or equal to
  count: number;
}

/**
 * Metrics store
 */
class MetricsCollector {
  private metrics: Map<string, Metric> = new Map();
  private histograms: Map<string, { buckets: HistogramBucket[]; sum: number; count: number }> = new Map();

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);

    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      this.metrics.set(key, {
        name,
        type: "counter",
        help: "",
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Set a gauge metric (absolute value)
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, {
      name,
      type: "gauge",
      help: "",
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        buckets: [
          { le: 0.1, count: 0 },
          { le: 0.5, count: 0 },
          { le: 1, count: 0 },
          { le: 2, count: 0 },
          { le: 5, count: 0 },
          { le: 10, count: 0 },
          { le: 30, count: 0 },
          { le: 60, count: 0 },
          { le: 120, count: 0 },
          { le: Infinity, count: 0 },
        ],
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    histogram.sum += value;
    histogram.count++;

    // Update buckets
    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Get metric key including labels
   */
  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    return `${name}{${labelStr}}`;
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Regular metrics
    for (const [key, metric] of this.metrics.entries()) {
      const labelStr = metric.labels
        ? "{" +
          Object.entries(metric.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(",") +
          "}"
        : "";
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      lines.push(`${metric.name}${labelStr} ${metric.value}`);
    }

    // Histograms
    for (const [key, histogram] of this.histograms.entries()) {
      const name = key.split("{")[0];
      const labelPart = key.includes("{") ? key.substring(key.indexOf("{")) : "";

      lines.push(`# TYPE ${name} histogram`);

      for (const bucket of histogram.buckets) {
        const bucketLabel = labelPart
          ? labelPart.slice(0, -1) + `,le="${bucket.le}"}`
          : `{le="${bucket.le}"}`;
        lines.push(`${name}_bucket${bucketLabel} ${bucket.count}`);
      }

      lines.push(`${name}_sum${labelPart} ${histogram.sum}`);
      lines.push(`${name}_count${labelPart} ${histogram.count}`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Get all metrics as JSON
   */
  getMetricsJSON(): any {
    return {
      metrics: Array.from(this.metrics.values()),
      histograms: Object.fromEntries(this.histograms.entries()),
      timestamp: Date.now(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.histograms.clear();
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

/**
 * Application metrics
 */
export const metrics = {
  // Research metrics
  researchRequestsTotal: (status: "success" | "error") =>
    metricsCollector.incrementCounter("research_requests_total", { status }),

  researchDurationSeconds: (duration: number) =>
    metricsCollector.observeHistogram("research_duration_seconds", duration),

  researchQueriesGenerated: (count: number) =>
    metricsCollector.setGauge("research_queries_generated", count),

  researchSourcesUsed: (count: number) =>
    metricsCollector.setGauge("research_sources_used", count),

  // API metrics
  apiCallsTotal: (provider: string, status: "success" | "error") =>
    metricsCollector.incrementCounter("api_calls_total", { provider, status }),

  apiCallDurationSeconds: (provider: string, duration: number) =>
    metricsCollector.observeHistogram("api_call_duration_seconds", duration, { provider }),

  apiCallRetries: (provider: string) =>
    metricsCollector.incrementCounter("api_call_retries_total", { provider }),

  apiCallErrors: (provider: string, errorType: string) =>
    metricsCollector.incrementCounter("api_call_errors_total", { provider, error_type: errorType }),

  // Cache metrics
  cacheHitsTotal: () => metricsCollector.incrementCounter("cache_hits_total"),

  cacheMissesTotal: () => metricsCollector.incrementCounter("cache_misses_total"),

  cacheSize: (size: number) => metricsCollector.setGauge("cache_size_bytes", size),

  // Security metrics
  rateLimitExceeded: () => metricsCollector.incrementCounter("rate_limit_exceeded_total"),

  promptInjectionDetected: (confidence: string) =>
    metricsCollector.incrementCounter("prompt_injection_detected_total", { confidence }),

  // Cost metrics
  estimatedCost: (amount: number, currency: string = "USD") =>
    metricsCollector.setGauge("estimated_cost", amount, { currency }),

  // System metrics
  activeRequests: (count: number) =>
    metricsCollector.setGauge("active_requests", count),

  memoryUsageBytes: () => {
    const usage = process.memoryUsage();
    metricsCollector.setGauge("memory_heap_used_bytes", usage.heapUsed);
    metricsCollector.setGauge("memory_heap_total_bytes", usage.heapTotal);
    metricsCollector.setGauge("memory_rss_bytes", usage.rss);
  },

  cpuUsage: () => {
    const usage = process.cpuUsage();
    metricsCollector.setGauge("cpu_user_microseconds", usage.user);
    metricsCollector.setGauge("cpu_system_microseconds", usage.system);
  },

  // Get all metrics
  getPrometheusMetrics: () => metricsCollector.getPrometheusMetrics(),
  getMetricsJSON: () => metricsCollector.getMetricsJSON(),
  reset: () => metricsCollector.reset(),
};

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor(private name: string) {
    this.startTime = Date.now();
  }

  /**
   * Stop timer and record metric
   */
  stop(): number {
    this.endTime = Date.now();
    const duration = (this.endTime - this.startTime) / 1000; // Convert to seconds
    return duration;
  }

  /**
   * Stop timer and record as histogram
   */
  stopAndRecord(metricFunc: (duration: number) => void): number {
    const duration = this.stop();
    if (getConfig().monitoring.enableMetrics) {
      metricFunc(duration);
    }
    return duration;
  }
}

/**
 * Cost tracking
 */
export class CostTracker {
  private costs: { timestamp: number; amount: number; operation: string }[] = [];

  /**
   * Record cost for an operation
   */
  recordCost(amount: number, operation: string): void {
    this.costs.push({
      timestamp: Date.now(),
      amount,
      operation,
    });

    // Update metric
    if (getConfig().monitoring.enableMetrics) {
      const total = this.getTotalCost();
      metrics.estimatedCost(total);
    }
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    return this.costs.reduce((sum, cost) => sum + cost.amount, 0);
  }

  /**
   * Get costs for last N minutes
   */
  getCostsSince(minutes: number): number {
    const since = Date.now() - minutes * 60 * 1000;
    return this.costs
      .filter((cost) => cost.timestamp >= since)
      .reduce((sum, cost) => sum + cost.amount, 0);
  }

  /**
   * Check if cost budget exceeded
   */
  checkBudget(maxCost: number): { exceeded: boolean; current: number; remaining: number } {
    const current = this.getTotalCost();
    return {
      exceeded: current >= maxCost,
      current,
      remaining: Math.max(0, maxCost - current),
    };
  }

  /**
   * Reset costs
   */
  reset(): void {
    this.costs = [];
  }

  /**
   * Get cost breakdown
   */
  getBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const cost of this.costs) {
      breakdown[cost.operation] = (breakdown[cost.operation] || 0) + cost.amount;
    }
    return breakdown;
  }
}

/**
 * Collect system metrics periodically
 */
let metricsInterval: NodeJS.Timeout | null = null;

export function startMetricsCollection(intervalMs: number = 10000): void {
  if (metricsInterval) {
    return; // Already running
  }

  metricsInterval = setInterval(() => {
    if (getConfig().monitoring.enableMetrics) {
      metrics.memoryUsageBytes();
      metrics.cpuUsage();
    }
  }, intervalMs);
}

export function stopMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

// Start collecting metrics if enabled
if (getConfig().monitoring.enableMetrics) {
  startMetricsCollection();
}
