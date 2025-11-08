/**
 * Enterprise Configuration Management System
 *
 * Provides centralized, validated, environment-aware configuration
 * with security best practices and comprehensive documentation.
 */

import { z } from "zod";
import "dotenv/config";

/**
 * Environment types
 */
export type Environment = "development" | "staging" | "production" | "test";

/**
 * Configuration schema with validation
 */
const ConfigSchema = z.object({
  // Environment
  env: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),

  // API Keys (Required)
  apiKeys: z.object({
    togetherAI: z
      .string()
      .min(1, "TOGETHER_API_KEY is required")
      .refine(
        (key) => key !== "your_together_api_key_here",
        "Please replace TOGETHER_API_KEY with your actual API key"
      ),
    exaSearch: z
      .string()
      .min(1, "EXA_API_KEY is required")
      .refine(
        (key) => key !== "your_exa_api_key_here",
        "Please replace EXA_API_KEY with your actual API key"
      ),
  }),

  // Server Configuration
  server: z.object({
    port: z.number().int().min(1).max(65535).default(3000),
    host: z.string().default("0.0.0.0"),
  }),

  // Logging Configuration
  logging: z.object({
    level: z
      .enum(["debug", "info", "success", "warn", "error"])
      .default("info"),
    format: z.enum(["json", "pretty"]).default("pretty"),
    colors: z.boolean().default(true),
  }),

  // Research Configuration
  research: z.object({
    budget: z.number().int().min(0).max(10).default(2),
    maxQueries: z.number().int().min(1).max(20).default(2),
    maxSources: z.number().int().min(1).max(50).default(5),
    maxTokens: z.number().int().min(1024).max(32768).default(8192),
  }),

  // Performance Configuration
  performance: z.object({
    requestTimeout: z.number().int().min(10000).max(600000).default(300000),
    maxConcurrentRequests: z.number().int().min(1).max(100).default(10),
    retryMaxAttempts: z.number().int().min(0).max(10).default(3),
    retryInitialDelay: z.number().int().min(100).max(10000).default(1000),
  }),

  // Database Configuration (Optional)
  database: z
    .object({
      url: z.string().optional(),
      maxConnections: z.number().int().min(1).max(100).default(20),
    })
    .optional(),

  // Redis Configuration (Optional)
  redis: z
    .object({
      url: z.string().optional(),
      ttl: z.number().int().min(60).max(86400).default(3600), // 1 hour default
    })
    .optional(),

  // Monitoring Configuration
  monitoring: z.object({
    enableMetrics: z.boolean().default(false),
    metricsPort: z.number().int().min(1).max(65535).optional(),
    enableTracing: z.boolean().default(false),
    jaegerEndpoint: z.string().url().optional(),
  }),

  // Security Configuration
  security: z.object({
    enableRateLimit: z.boolean().default(false),
    rateLimitRPM: z.number().int().min(1).max(10000).default(60),
    enablePromptInjectionDetection: z.boolean().default(true),
    sanitizeErrors: z.boolean().default(true),
    maxTopicLength: z.number().int().min(100).max(10000).default(1000),
  }),

  // Cost Management
  cost: z.object({
    enableTracking: z.boolean().default(false),
    maxCostPerRequest: z.number().min(0).max(100).default(1.0),
    alertThreshold: z.number().int().min(0).max(100).default(80),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Parse and validate configuration from environment variables
 */
function parseConfig(): AppConfig {
  const env = (process.env.NODE_ENV || "development") as Environment;

  const rawConfig = {
    env,
    apiKeys: {
      togetherAI: process.env.TOGETHER_API_KEY || "",
      exaSearch: process.env.EXA_API_KEY || "",
    },
    server: {
      port: parseInt(process.env.PORT || "3000", 10),
      host: process.env.HOST || "0.0.0.0",
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || getDefaultLogLevel(env),
      format: (process.env.LOG_FORMAT as any) || "pretty",
      colors: process.env.LOG_COLORS !== "false",
    },
    research: {
      budget: parseInt(process.env.RESEARCH_BUDGET || "2", 10),
      maxQueries: parseInt(process.env.MAX_QUERIES || "2", 10),
      maxSources: parseInt(process.env.MAX_SOURCES || "5", 10),
      maxTokens: parseInt(process.env.MAX_COMPLETION_TOKENS || "8192", 10),
    },
    performance: {
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "300000", 10),
      maxConcurrentRequests: parseInt(
        process.env.MAX_CONCURRENT_REQUESTS || "10",
        10
      ),
      retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || "3", 10),
      retryInitialDelay: parseInt(
        process.env.RETRY_INITIAL_DELAY || "1000",
        10
      ),
    },
    database: process.env.DATABASE_URL
      ? {
          url: process.env.DATABASE_URL,
          maxConnections: parseInt(
            process.env.DATABASE_MAX_CONNECTIONS || "20",
            10
          ),
        }
      : undefined,
    redis: process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
          ttl: parseInt(process.env.REDIS_TTL || "3600", 10),
        }
      : undefined,
    monitoring: {
      enableMetrics: process.env.ENABLE_METRICS === "true",
      metricsPort: process.env.METRICS_PORT
        ? parseInt(process.env.METRICS_PORT, 10)
        : undefined,
      enableTracing: process.env.ENABLE_TRACING === "true",
      jaegerEndpoint: process.env.JAEGER_ENDPOINT,
    },
    security: {
      enableRateLimit:
        process.env.ENABLE_RATE_LIMIT === "true" || env === "production",
      rateLimitRPM: parseInt(process.env.RATE_LIMIT_RPM || "60", 10),
      enablePromptInjectionDetection:
        process.env.ENABLE_PROMPT_INJECTION_DETECTION !== "false",
      sanitizeErrors:
        process.env.SANITIZE_ERRORS === "true" || env === "production",
      maxTopicLength: parseInt(process.env.MAX_TOPIC_LENGTH || "1000", 10),
    },
    cost: {
      enableTracking: process.env.ENABLE_COST_TRACKING === "true",
      maxCostPerRequest: parseFloat(
        process.env.MAX_COST_PER_REQUEST || "1.0"
      ),
      alertThreshold: parseInt(process.env.COST_ALERT_THRESHOLD || "80", 10),
    },
  };

  try {
    const config = ConfigSchema.parse(rawConfig);

    // Apply environment-specific overrides
    return applyEnvironmentDefaults(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors
        .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(
        `Configuration validation failed:\n${errors}\n\nPlease check your .env file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}

/**
 * Get default log level based on environment
 */
function getDefaultLogLevel(env: Environment): string {
  switch (env) {
    case "production":
      return "warn";
    case "staging":
      return "info";
    case "development":
    case "test":
      return "debug";
    default:
      return "info";
  }
}

/**
 * Apply environment-specific configuration defaults
 */
function applyEnvironmentDefaults(config: AppConfig): AppConfig {
  if (config.env === "production") {
    return {
      ...config,
      security: {
        ...config.security,
        sanitizeErrors: true,
        enableRateLimit: true,
      },
      monitoring: {
        ...config.monitoring,
        enableMetrics: true,
      },
    };
  }

  if (config.env === "test") {
    return {
      ...config,
      logging: {
        ...config.logging,
        level: "error", // Quiet logs during tests
      },
    };
  }

  return config;
}

/**
 * Singleton configuration instance
 */
let configInstance: AppConfig | null = null;

/**
 * Get validated configuration instance
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = parseConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().env === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().env === "development";
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getConfig().env === "test";
}

/**
 * Get masked API keys for logging (shows only first/last 4 characters)
 */
export function getMaskedApiKeys(): {
  togetherAI: string;
  exaSearch: string;
} {
  const config = getConfig();
  return {
    togetherAI: maskApiKey(config.apiKeys.togetherAI),
    exaSearch: maskApiKey(config.apiKeys.exaSearch),
  };
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return "***";
  }
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// Validate configuration on module load (fail fast)
try {
  getConfig();
} catch (error) {
  if (process.env.NODE_ENV !== "test") {
    console.error("❌ Configuration Error:");
    console.error((error as Error).message);
    process.exit(1);
  }
}
