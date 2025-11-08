/**
 * Health Check System
 *
 * Provides health and readiness endpoints for monitoring and orchestration.
 * Compatible with Kubernetes liveness and readiness probes.
 */

import { getConfig } from "./config-manager";
import { circuitBreakers } from "./circuit-breaker";
import { metrics } from "./metrics";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: any;
  timestamp: number;
  duration?: number;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  timestamp: number;
  checks: HealthCheck[];
  uptime: number;
}

/**
 * Check function type
 */
export type CheckFunction = () => Promise<HealthCheck>;

/**
 * Health check registry
 */
class HealthCheckRegistry {
  private checks = new Map<string, CheckFunction>();
  private startTime = Date.now();

  /**
   * Register a health check
   */
  register(name: string, checkFn: CheckFunction): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Run all health checks
   */
  async runAll(): Promise<HealthResponse> {
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        const start = Date.now();
        try {
          const result = await Promise.race([
            checkFn(),
            new Promise<HealthCheck>((_, reject) =>
              setTimeout(() => reject(new Error("Health check timeout")), 5000)
            ),
          ]);
          result.duration = Date.now() - start;
          return result;
        } catch (error) {
          return {
            name,
            status: "unhealthy" as HealthStatus,
            message:
              error instanceof Error ? error.message : "Health check failed",
            timestamp: Date.now(),
            duration: Date.now() - start,
          };
        }
      }
    );

    const checks = await Promise.all(checkPromises);

    // Determine overall status
    const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
    const hasDegraded = checks.some((c) => c.status === "degraded");

    let overallStatus: HealthStatus = "healthy";
    if (hasUnhealthy) {
      overallStatus = "unhealthy";
    } else if (hasDegraded) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      version: process.env.npm_package_version || "0.1.0",
      timestamp: Date.now(),
      checks,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Run a single health check
   */
  async runCheck(name: string): Promise<HealthCheck | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return null;
    }

    const start = Date.now();
    try {
      const result = await checkFn();
      result.duration = Date.now() - start;
      return result;
    } catch (error) {
      return {
        name,
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Health check failed",
        timestamp: Date.now(),
        duration: Date.now() - start,
      };
    }
  }
}

// Singleton registry
const healthRegistry = new HealthCheckRegistry();

/**
 * Register a custom health check
 */
export function registerHealthCheck(
  name: string,
  checkFn: CheckFunction
): void {
  healthRegistry.register(name, checkFn);
}

/**
 * Get health status
 */
export async function getHealth(): Promise<HealthResponse> {
  return healthRegistry.runAll();
}

/**
 * Get readiness status (can accept traffic)
 */
export async function getReadiness(): Promise<HealthResponse> {
  // Readiness is stricter - any degraded service makes us not ready
  const health = await healthRegistry.runAll();

  const notReady =
    health.checks.some((c) => c.status === "unhealthy") ||
    health.checks.some((c) => c.status === "degraded");

  if (notReady) {
    health.status = "unhealthy";
  }

  return health;
}

/**
 * Get liveness status (is alive)
 */
export async function getLiveness(): Promise<{ alive: boolean }> {
  // Simple alive check - just return true if process is running
  return { alive: true };
}

// ========== Built-in Health Checks ==========

/**
 * Memory usage health check
 */
healthRegistry.register("memory", async () => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const heapUsedPercent = (heapUsedMB / heapTotalMB) * 100;

  let status: HealthStatus = "healthy";
  let message = `Heap usage: ${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB (${heapUsedPercent.toFixed(1)}%)`;

  if (heapUsedPercent > 90) {
    status = "unhealthy";
    message = `Memory usage critical: ${heapUsedPercent.toFixed(1)}%`;
  } else if (heapUsedPercent > 75) {
    status = "degraded";
    message = `Memory usage high: ${heapUsedPercent.toFixed(1)}%`;
  }

  return {
    name: "memory",
    status,
    message,
    details: {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      heapUsedPercent,
      rss: usage.rss / 1024 / 1024,
    },
    timestamp: Date.now(),
  };
});

/**
 * Configuration health check
 */
healthRegistry.register("config", async () => {
  try {
    const config = getConfig();

    // Check if API keys are set
    const hasTogetherKey = config.apiKeys.togetherAI.length > 0;
    const hasExaKey = config.apiKeys.exaSearch.length > 0;

    if (!hasTogetherKey || !hasExaKey) {
      return {
        name: "config",
        status: "unhealthy",
        message: "Missing required API keys",
        details: {
          hasTogetherKey,
          hasExaKey,
        },
        timestamp: Date.now(),
      };
    }

    return {
      name: "config",
      status: "healthy",
      message: "Configuration valid",
      details: {
        env: config.env,
        hasTogetherKey,
        hasExaKey,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      name: "config",
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Configuration error",
      timestamp: Date.now(),
    };
  }
});

/**
 * Circuit breakers health check
 */
healthRegistry.register("circuit-breakers", async () => {
  const stats = circuitBreakers.getAllStats();
  const openCircuits = Object.entries(stats).filter(
    ([_, s]) => s.state === "OPEN"
  );
  const halfOpenCircuits = Object.entries(stats).filter(
    ([_, s]) => s.state === "HALF_OPEN"
  );

  let status: HealthStatus = "healthy";
  let message = "All circuits closed";

  if (openCircuits.length > 0) {
    status = "degraded";
    message = `${openCircuits.length} circuit(s) open`;
  }

  if (halfOpenCircuits.length > 0 && openCircuits.length === 0) {
    status = "degraded";
    message = `${halfOpenCircuits.length} circuit(s) half-open`;
  }

  return {
    name: "circuit-breakers",
    status,
    message,
    details: {
      circuits: stats,
      openCount: openCircuits.length,
      halfOpenCount: halfOpenCircuits.length,
    },
    timestamp: Date.now(),
  };
});

/**
 * System info health check
 */
healthRegistry.register("system", async () => {
  const uptime = process.uptime();
  const uptimeHours = uptime / 3600;

  return {
    name: "system",
    status: "healthy",
    message: `Uptime: ${uptimeHours.toFixed(2)} hours`,
    details: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: uptime,
      pid: process.pid,
    },
    timestamp: Date.now(),
  };
});

/**
 * Metrics health check
 */
healthRegistry.register("metrics", async () => {
  const config = getConfig();

  if (!config.monitoring.enableMetrics) {
    return {
      name: "metrics",
      status: "healthy",
      message: "Metrics collection disabled",
      timestamp: Date.now(),
    };
  }

  try {
    const metricsData = metrics.getMetricsJSON();

    return {
      name: "metrics",
      status: "healthy",
      message: "Metrics collection enabled",
      details: {
        metricsCount: metricsData.metrics.length,
        histogramsCount: Object.keys(metricsData.histograms).length,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      name: "metrics",
      status: "degraded",
      message: "Metrics collection error",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      timestamp: Date.now(),
    };
  }
});

/**
 * Format health response for HTTP
 */
export function formatHealthResponse(
  health: HealthResponse
): { statusCode: number; body: string } {
  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return {
    statusCode,
    body: JSON.stringify(health, null, 2),
  };
}

/**
 * Simple health check endpoint handler
 */
export async function healthCheckHandler(): Promise<{
  statusCode: number;
  body: string;
}> {
  const health = await getHealth();
  return formatHealthResponse(health);
}

/**
 * Readiness check endpoint handler
 */
export async function readinessCheckHandler(): Promise<{
  statusCode: number;
  body: string;
}> {
  const readiness = await getReadiness();
  return formatHealthResponse(readiness);
}

/**
 * Liveness check endpoint handler
 */
export async function livenessCheckHandler(): Promise<{
  statusCode: number;
  body: string;
}> {
  const liveness = await getLiveness();
  return {
    statusCode: 200,
    body: JSON.stringify(liveness),
  };
}
