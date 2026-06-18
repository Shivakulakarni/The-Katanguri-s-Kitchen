/**
 * Input sanitization utilities.
 * Apply these to all user-supplied text fields to prevent XSS and injection.
 */

/**
 * Sanitize a text string by removing potentially dangerous characters.
 * Use for user-supplied text like names, notes, comments, addresses.
 * Max length is enforced to prevent abuse.
 */
export function sanitizeText(
  input: string | undefined | null,
  options?: { maxLength?: number; stripHtml?: boolean }
): string | null {
  if (!input || typeof input !== 'string') return null;

  const maxLength = options?.maxLength ?? 500;
  const stripHtml = options?.stripHtml ?? true;

  let sanitized = input.trim();

  if (stripHtml) {
    // Remove HTML tags and strip remaining dangerous characters in one pass
    sanitized = sanitized.replace(/<[^>]*>/g, '').replace(/["'&]/g, '');
  }

  // Enforce max length
  sanitized = sanitized.slice(0, maxLength);

  return sanitized || null;
}

/**
 * Sanitize a string that should not contain any HTML or special characters.
 * Use for short fields like names, labels, category names.
 */
export function sanitizePlainText(
  input: string | undefined | null,
  maxLength: number = 100
): string | null {
  if (!input || typeof input !== 'string') return null;

  return input
    .trim()
    .replace(/[<>"'&\\/]/g, '')
    .slice(0, maxLength) || null;
}

/**
 * Sanitize a numeric string (e.g., phone numbers, pin codes).
 * Strips everything except digits and allowed chars.
 */
export function sanitizeNumeric(
  input: string | undefined | null,
  options?: { allowPlus?: boolean; allowDash?: boolean }
): string | null {
  if (!input || typeof input !== 'string') return null;

  let pattern = /[^0-9]/g;
  if (options?.allowPlus) pattern = /[^0-9+]/g;
  if (options?.allowDash) pattern = /[^0-9+-]/g;

  return input.trim().replace(pattern, '').slice(0, 20) || null;
}
