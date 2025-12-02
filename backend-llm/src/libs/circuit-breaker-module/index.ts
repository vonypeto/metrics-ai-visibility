import { Injectable, Logger } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time to wait before trying half-open (ms)
  windowSize: number; // Time window for counting failures (ms)
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  state: CircuitState;
}

/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking requests to failing services.
 * States:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits: Map<string, CircuitStats> = new Map();
  private configs: Map<string, CircuitBreakerConfig> = new Map();

  /**
   * Register a circuit breaker for a service
   */
  registerCircuit(
    serviceName: string,
    config: Partial<CircuitBreakerConfig> = {},
  ): void {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
      windowSize: 120000, // 2 minutes
      ...config,
    };

    this.configs.set(serviceName, defaultConfig);
    this.circuits.set(serviceName, {
      failures: 0,
      successes: 0,
      state: CircuitState.CLOSED,
    });

    this.logger.log(
      `Circuit breaker registered for ${serviceName}: ${JSON.stringify(defaultConfig)}`,
    );
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    const circuit = this.circuits.get(serviceName);
    const config = this.configs.get(serviceName);

    if (!circuit || !config) {
      // No circuit breaker configured, execute normally
      return fn();
    }

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      const now = Date.now();
      const timeSinceLastFailure = now - (circuit.lastFailureTime || 0);

      if (timeSinceLastFailure >= config.timeout) {
        // Try half-open
        this.logger.log(`Circuit ${serviceName} transitioning to HALF_OPEN`);
        circuit.state = CircuitState.HALF_OPEN;
        circuit.successes = 0;
      } else {
        // Still open, reject immediately
        throw new Error(
          `Circuit breaker is OPEN for ${serviceName}. Service is temporarily unavailable.`,
        );
      }
    }

    // Execute the function
    try {
      const result = await fn();
      this.onSuccess(serviceName);
      return result;
    } catch (error) {
      this.onFailure(serviceName);
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    const config = this.configs.get(serviceName);

    if (!circuit || !config) return;

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successes++;
      if (circuit.successes >= config.successThreshold) {
        this.logger.log(`Circuit ${serviceName} transitioning to CLOSED`);
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.successes = 0;
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success
      circuit.failures = 0;
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    const config = this.configs.get(serviceName);

    if (!circuit || !config) return;

    circuit.lastFailureTime = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failed during half-open, go back to open
      this.logger.warn(
        `Circuit ${serviceName} failed during HALF_OPEN, transitioning back to OPEN`,
      );
      circuit.state = CircuitState.OPEN;
      circuit.failures = 0;
      circuit.successes = 0;
    } else if (circuit.state === CircuitState.CLOSED) {
      circuit.failures++;

      // Clean up old failures outside the window
      const now = Date.now();
      if (now - (circuit.lastFailureTime || 0) > config.windowSize) {
        circuit.failures = 1; // Reset to current failure
      }

      if (circuit.failures >= config.failureThreshold) {
        this.logger.error(
          `Circuit ${serviceName} transitioning to OPEN after ${circuit.failures} failures`,
        );
        circuit.state = CircuitState.OPEN;
      }
    }
  }

  /**
   * Get the current state of a circuit
   */
  getState(serviceName: string): CircuitState {
    return this.circuits.get(serviceName)?.state || CircuitState.CLOSED;
  }

  /**
   * Get statistics for a circuit
   */
  getStats(serviceName: string): CircuitStats | undefined {
    return this.circuits.get(serviceName);
  }

  /**
   * Manually reset a circuit to closed state
   */
  reset(serviceName: string): void {
    const circuit = this.circuits.get(serviceName);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.lastFailureTime = undefined;
      this.logger.log(`Circuit ${serviceName} manually reset to CLOSED`);
    }
  }

  /**
   * Get all circuits status
   */
  getAllCircuits(): Record<string, CircuitStats> {
    const result: Record<string, CircuitStats> = {};
    this.circuits.forEach((stats, name) => {
      result[name] = { ...stats };
    });
    return result;
  }
}
