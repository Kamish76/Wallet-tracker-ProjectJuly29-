import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_STORAGE_KEY = '@orgwallet_rate_limit_history';

export class RateLimitError extends Error {
  public retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RateLimitPolicy {
  maxAttempts: number;
  windowSeconds: number;
}

export const RateLimitPolicies = {
  AUTH_LOGIN: { maxAttempts: 5, windowSeconds: 60 },      // 5 login attempts per minute
  AUTH_OAUTH: { maxAttempts: 10, windowSeconds: 60 },     // 10 OAuth attempts per minute
  SYNC_NOW: { maxAttempts: 10, windowSeconds: 60 },       // 10 sync attempts per minute
  MUTATION_CREATE: { maxAttempts: 60, windowSeconds: 60 }, // 60 mutations per minute
} as const;

export class RateLimiter {
  private static memoryCache: Map<string, number[]> = new Map();
  private static isLoaded = false;

  private static async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, number[]> = JSON.parse(raw);
        const now = Date.now();
        for (const [action, timestamps] of Object.entries(parsed)) {
          // Keep only timestamps from the last 24 hours in storage cache
          const recent = timestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
          if (recent.length > 0) {
            this.memoryCache.set(action, recent);
          }
        }
      }
      this.isLoaded = true;
    } catch (e) {
      console.error('[RateLimiter] Error loading rate limit history from storage:', e);
      this.isLoaded = true;
    }
  }

  private static async saveToStorage(): Promise<void> {
    try {
      const obj: Record<string, number[]> = {};
      const now = Date.now();
      for (const [action, timestamps] of this.memoryCache.entries()) {
        const recent = timestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
        if (recent.length > 0) {
          obj[action] = recent;
        }
      }
      await AsyncStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('[RateLimiter] Error saving rate limit history to storage:', e);
    }
  }

  /**
   * Check if an action is currently allowed under the specified rate limit policy.
   */
  public static async checkLimit(
    action: string,
    policy: RateLimitPolicy
  ): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    await this.ensureLoaded();
    const now = Date.now();
    const windowMs = policy.windowSeconds * 1000;

    const timestamps = (this.memoryCache.get(action) || []).filter(
      (t) => now - t < windowMs
    );
    this.memoryCache.set(action, timestamps);

    if (timestamps.length >= policy.maxAttempts) {
      const oldestTimestamp = timestamps[0];
      const resetTime = oldestTimestamp + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: policy.maxAttempts - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Record a new attempt timestamp for the specified action.
   */
  public static async recordAttempt(action: string, policy?: RateLimitPolicy): Promise<void> {
    await this.ensureLoaded();
    const now = Date.now();
    const windowMs = policy ? policy.windowSeconds * 1000 : 24 * 60 * 60 * 1000;
    const timestamps = (this.memoryCache.get(action) || []).filter(
      (t) => now - t < windowMs
    );
    timestamps.push(now);
    this.memoryCache.set(action, timestamps);
    await this.saveToStorage();
  }

  /**
   * Assert that an action is allowed; if exceeded, throws a RateLimitError.
   */
  public static async assertAllowed(action: string, policy: RateLimitPolicy): Promise<void> {
    const status = await this.checkLimit(action, policy);
    if (!status.allowed) {
      throw new RateLimitError(
        `Too many attempts. Please wait ${status.retryAfterSeconds} seconds before trying again.`,
        status.retryAfterSeconds
      );
    }
  }

  /**
   * Clear recorded attempts for an action (e.g., after successful authentication).
   */
  public static async reset(action: string): Promise<void> {
    await this.ensureLoaded();
    this.memoryCache.delete(action);
    await this.saveToStorage();
  }
}
