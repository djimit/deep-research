/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking requests to failing services.
 * Implements the three states: CLOSED, OPEN, HALF_OPEN
 */

import { Logger } from "./logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening circuit
   */
  failureThreshold: number;

  /**
   * Time window for failure counting (ms)
   */
  failureWindow: number;

  /**
   * Time to wait before attempting to close circuit (ms)
   */
  resetTimeout: number;

  /**
   * Number of successful requests needed to close circuit from half-open
   */
  successThreshold: number;

  /**
   * Optional logger
   */
  logger?: Logger;

  /**
   * Optional name for the circuit
   */
  name?: string;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public circuitName: string,
    public state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures: { timestamp: number }[] = [];
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private logger: Logger;
  private name: string;

  constructor(private options: CircuitBreakerOptions) {
    this.logger = options.logger || new Logger({ logLevel: "error" });
    this.name = options.name || "CircuitBreaker";
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "OPEN") {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.logger.info(`${this.name}: Attempting to close circuit (HALF_OPEN)`);
        this.state = "HALF_OPEN";
        this.successes = 0;
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Service temporarily unavailable.`,
          this.name,
          this.state
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successes++;
      this.logger.debug(
        `${this.name}: Success in HALF_OPEN state (${this.successes}/${this.options.successThreshold})`
      );

      if (this.successes >= this.options.successThreshold) {
        this.logger.success(`${this.name}: Circuit breaker closing (CLOSED)`);
        this.state = "CLOSED";
        this.failures = [];
        this.successes = 0;
      }
    } else if (this.state === "CLOSED") {
      // Clean up old failures
      this.cleanupOldFailures();
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failures.push({ timestamp: Date.now() });

    // Clean up old failures
    this.cleanupOldFailures();

    if (this.state === "HALF_OPEN") {
      // Return to OPEN state
      this.logger.warn(`${this.name}: Failure in HALF_OPEN state. Opening circuit again.`);
      this.state = "OPEN";
      this.successes = 0;
      return;
    }

    if (this.state === "CLOSED") {
      // Check if we should open the circuit
      if (this.failures.length >= this.options.failureThreshold) {
        this.logger.error(
          `${this.name}: Failure threshold reached (${this.failures.length}). Opening circuit.`
        );
        this.state = "OPEN";
      }
    }
  }

  /**
   * Remove failures outside the time window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindow;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
  } {
    this.cleanupOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Manually reset circuit
   */
  reset(): void {
    this.logger.info(`${this.name}: Circuit breaker manually reset`);
    this.state = "CLOSED";
    this.failures = [];
    this.successes = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Force circuit to open state
   */
  forceOpen(): void {
    this.logger.warn(`${this.name}: Circuit breaker manually opened`);
    this.state = "OPEN";
    this.lastFailureTime = Date.now();
  }
}

/**
 * Circuit breaker registry for managing multiple circuits
 */
class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    let circuit = this.circuits.get(name);

    if (!circuit) {
      circuit = new CircuitBreaker({
        failureThreshold: options?.failureThreshold || 5,
        failureWindow: options?.failureWindow || 60000, // 1 minute
        resetTimeout: options?.resetTimeout || 30000, // 30 seconds
        successThreshold: options?.successThreshold || 2,
        name,
        ...options,
      });
      this.circuits.set(name, circuit);
    }

    return circuit;
  }

  /**
   * Get circuit by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  /**
   * Get all circuits
   */
  getAll(): Map<string, CircuitBreaker> {
    return this.circuits;
  }

  /**
   * Get stats for all circuits
   */
  getAllStats(): Record<string, ReturnType<CircuitBreaker["getStats"]>> {
    const stats: Record<string, ReturnType<CircuitBreaker["getStats"]>> = {};
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = circuit.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }

  /**
   * Clear all circuits
   */
  clear(): void {
    this.circuits.clear();
  }
}

// Singleton registry
export const circuitBreakers = new CircuitBreakerRegistry();

/**
 * Get circuit breaker for external APIs
 */
export function getApiCircuitBreaker(apiName: string): CircuitBreaker {
  return circuitBreakers.getOrCreate(`api:${apiName}`, {
    failureThreshold: 3,
    failureWindow: 60000, // 1 minute
    resetTimeout: 30000, // 30 seconds
    successThreshold: 2,
  });
}

/**
 * Execute function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  circuitName: string,
  fn: () => Promise<T>,
  options?: Partial<CircuitBreakerOptions>
): Promise<T> {
  const circuit = circuitBreakers.getOrCreate(circuitName, options);
  return circuit.execute(fn);
}
