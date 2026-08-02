import { isValidUUID } from '@/lib/utils/uuid';
import { RateLimiter, RateLimitPolicies } from '@/lib/security/rateLimiter';

export class SecurityService {
  /**
   * Validates and sanitizes an email address.
   */
  public static sanitizeEmail(email: string): { isValid: boolean; sanitized: string; error?: string } {
    const trimmed = (email || '').trim().toLowerCase();
    if (!trimmed) {
      return { isValid: false, sanitized: '', error: 'Email address is required.' };
    }

    // Basic regex for RFC 5322 standard email structure
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, sanitized: trimmed, error: 'Please enter a valid email address.' };
    }

    // Protect against excessively long inputs
    if (trimmed.length > 254) {
      return { isValid: false, sanitized: trimmed.slice(0, 254), error: 'Email address exceeds maximum length.' };
    }

    return { isValid: true, sanitized: trimmed };
  }

  /**
   * Sanitizes user-provided text inputs (e.g. descriptions, category names, account titles).
   * Strips ASCII control characters, HTML/script tags, and enforces maximum character limits.
   */
  public static sanitizeText(input: string | null | undefined, maxLength = 200): string {
    if (!input) return '';
    const stringified = String(input);

    // Remove ASCII control characters (0-8, 11-12, 14-31, 127)
    const withoutControls = stringified.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Strip basic script/HTML tags to prevent XSS/injection payloads
    const withoutTags = withoutControls.replace(/<[^>]*>?/gm, '');

    return withoutTags.trim().slice(0, maxLength);
  }

  /**
   * Validates numeric transaction amounts to prevent NaN, Infinity, overflow, or invalid negatives.
   */
  public static validateAmount(
    amount: any,
    options?: { min?: number; max?: number }
  ): { isValid: boolean; value: number; error?: string } {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount));

    if (isNaN(num) || !isFinite(num)) {
      return { isValid: false, value: 0, error: 'Invalid numeric amount.' };
    }

    const min = options?.min ?? 0.01;
    const max = options?.max ?? 1_000_000_000; // 1 Billion cap to prevent integer overflow

    if (num < min) {
      return { isValid: false, value: num, error: `Amount must be at least $${min.toFixed(2)}.` };
    }
    if (num > max) {
      return { isValid: false, value: num, error: `Amount exceeds maximum limit of $${max.toLocaleString()}.` };
    }

    // Round to 2 decimal places to prevent floating-point drift
    const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
    return { isValid: true, value: rounded };
  }

  /**
   * Verifies that a given string is a strictly valid UUID v4.
   */
  public static validateUUID(id: string | null | undefined): boolean {
    if (!id) return false;
    return isValidUUID(id);
  }

  /**
   * Helper to inspect current rate limits across primary sensitive actions.
   */
  public static async getSecurityStatus(): Promise<{
    loginAllowed: boolean;
    syncAllowed: boolean;
  }> {
    const loginStatus = await RateLimiter.checkLimit('auth:login', RateLimitPolicies.AUTH_LOGIN);
    const syncStatus = await RateLimiter.checkLimit('sync:now', RateLimitPolicies.SYNC_NOW);

    return {
      loginAllowed: loginStatus.allowed,
      syncAllowed: syncStatus.allowed,
    };
  }
}
