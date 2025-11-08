/**
 * Enterprise Security Utilities
 *
 * Provides security features including:
 * - Prompt injection detection
 * - Input sanitization
 * - Error message sanitization
 * - API key validation
 */

import { getConfig } from "./config-manager";

/**
 * Prompt injection patterns to detect
 */
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction injections
  /ignore\s+(previous|above|all)\s+instructions/i,
  /disregard\s+(previous|above|all)\s+(instructions|directions)/i,
  /forget\s+(previous|above|all)\s+instructions/i,

  // System message injections
  /system\s*:\s*</i,
  /<\|system\|>/i,
  /\[SYSTEM\]/i,

  // Role manipulation
  /you\s+are\s+now/i,
  /act\s+as\s+(a|an)/i,
  /pretend\s+(to\s+be|you\s+are)/i,

  // Escape attempts
  /```[\s\S]*system/i,
  /"""\s*system/i,

  // Output manipulation
  /output\s+(in|as)\s+json/i,
  /respond\s+only\s+with/i,

  // Jailbreak attempts
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,

  // Code execution attempts
  /<script>/i,
  /javascript:/i,
  /eval\(/i,
  /exec\(/i,

  // SQL injection patterns (just in case)
  /;\s*drop\s+table/i,
  /'\s*or\s*'1'\s*=\s*'1/i,
  /--\s*$/,

  // XML/XXE injection
  /<!ENTITY/i,
  /<!DOCTYPE/i,

  // Path traversal
  /\.\.(\/|\\)/,
  /%2e%2e/i,
];

/**
 * Dangerous characters that should be escaped or removed
 */
const DANGEROUS_CHARS = [
  "<script",
  "</script",
  "javascript:",
  "data:text/html",
  "vbscript:",
  "onclick=",
  "onerror=",
  "onload=",
];

/**
 * Detect potential prompt injection attempts
 */
export function detectPromptInjection(input: string): {
  detected: boolean;
  patterns: string[];
  confidence: "low" | "medium" | "high";
} {
  const config = getConfig();

  if (!config.security.enablePromptInjectionDetection) {
    return { detected: false, patterns: [], confidence: "low" };
  }

  const detectedPatterns: string[] = [];

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      detectedPatterns.push(pattern.source);
    }
  }

  // Check for dangerous characters
  const lowerInput = input.toLowerCase();
  for (const dangerous of DANGEROUS_CHARS) {
    if (lowerInput.includes(dangerous)) {
      detectedPatterns.push(`Dangerous string: ${dangerous}`);
    }
  }

  // Calculate confidence based on number of detections
  let confidence: "low" | "medium" | "high" = "low";
  if (detectedPatterns.length >= 3) {
    confidence = "high";
  } else if (detectedPatterns.length >= 1) {
    confidence = "medium";
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    confidence,
  };
}

/**
 * Sanitize user input
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Remove potentially dangerous HTML/script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // Limit length
  const maxLength = getConfig().security.maxTopicLength;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validate and sanitize research topic
 */
export function validateResearchTopic(topic: string): {
  valid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if empty
  if (!topic || topic.trim().length === 0) {
    errors.push("Research topic cannot be empty");
    return { valid: false, sanitized: "", errors };
  }

  // Sanitize input
  const sanitized = sanitizeInput(topic);

  // Check length after sanitization
  if (sanitized.length === 0) {
    errors.push("Research topic is empty after sanitization");
    return { valid: false, sanitized: "", errors };
  }

  const config = getConfig();
  if (sanitized.length > config.security.maxTopicLength) {
    errors.push(
      `Research topic is too long (max ${config.security.maxTopicLength} characters)`
    );
  }

  // Check for prompt injection
  const injection = detectPromptInjection(sanitized);
  if (injection.detected && injection.confidence !== "low") {
    errors.push(
      `Potential security issue detected: ${injection.patterns.join(", ")}`
    );
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors,
  };
}

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(error: Error | unknown): string {
  const config = getConfig();

  if (!config.security.sanitizeErrors) {
    // In development, show full error
    if (error instanceof Error) {
      return error.stack || error.message;
    }
    return String(error);
  }

  // In production, show generic message
  if (error instanceof Error) {
    // Remove sensitive information from error message
    let message = error.message;

    // Remove API keys
    message = message.replace(/[a-zA-Z0-9]{32,}/g, "[REDACTED]");

    // Remove file paths
    message = message.replace(/\/[^\s]+/g, "[PATH]");

    // Remove URLs
    message = message.replace(/https?:\/\/[^\s]+/g, "[URL]");

    // Remove email addresses
    message = message.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");

    // Generic messages for known error types
    if (message.includes("ECONNREFUSED")) {
      return "Service temporarily unavailable. Please try again later.";
    }

    if (message.includes("ETIMEDOUT")) {
      return "Request timed out. Please try again.";
    }

    if (message.includes("401") || message.includes("403")) {
      return "Authentication error. Please check your API configuration.";
    }

    if (message.includes("429")) {
      return "Rate limit exceeded. Please try again in a few minutes.";
    }

    if (message.includes("500") || message.includes("502") || message.includes("503")) {
      return "External service error. Please try again later.";
    }

    return message;
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string, keyName: string): void {
  if (!key || key.trim().length === 0) {
    throw new Error(`${keyName} is required`);
  }

  if (key.includes("your_") || key.includes("_key_here")) {
    throw new Error(
      `Please replace ${keyName} with your actual API key. Check your .env file.`
    );
  }

  // Basic length check (most API keys are at least 20 characters)
  if (key.length < 20) {
    throw new Error(
      `${keyName} appears to be invalid (too short). Please check your .env file.`
    );
  }
}

/**
 * Rate limiting state (in-memory for single instance)
 * For production, use Redis
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for an identifier (IP, user ID, etc.)
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const config = getConfig();

  if (!config.security.enableRateLimit) {
    return { allowed: true, remaining: Infinity, resetAt: 0 };
  }

  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const limit = config.security.rateLimitRPM;

  const record = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (record && record.resetAt < now) {
    rateLimitStore.delete(identifier);
  }

  // Get or create record
  const current = rateLimitStore.get(identifier) || {
    count: 0,
    resetAt: now + windowMs,
  };

  // Check if limit exceeded
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(identifier, current);

  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: current.resetAt,
  };
}

/**
 * Reset rate limit for an identifier (useful for testing)
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [identifier, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(identifier);
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

/**
 * Security error class
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends SecurityError {
  constructor(
    public resetAt: number,
    public remaining: number = 0
  ) {
    super(
      `Rate limit exceeded. Try again in ${Math.ceil((resetAt - Date.now()) / 1000)} seconds.`,
      "RATE_LIMIT_EXCEEDED",
      { resetAt, remaining }
    );
    this.name = "RateLimitError";
  }
}

/**
 * Prompt injection error class
 */
export class PromptInjectionError extends SecurityError {
  constructor(
    public patterns: string[],
    public confidence: "low" | "medium" | "high"
  ) {
    super(
      "Potential security issue detected in input. Please rephrase your request.",
      "PROMPT_INJECTION_DETECTED",
      { patterns, confidence }
    );
    this.name = "PromptInjectionError";
  }
}
