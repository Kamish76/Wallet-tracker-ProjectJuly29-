/**
 * Formats an ISO timestamp string as a local calendar date (`YYYY-MM-DD`),
 * avoiding UTC off-by-one-day drift near midnight.
 */
export function formatLocalDateInput(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Merges a `YYYY-MM-DD` local calendar date string with the time-of-day
 * (hours, minutes, seconds, milliseconds) from `originalIso`.
 * Falls back to 12:00:00.000 local time if `originalIso` is missing or invalid.
 */
export function mergeDateWithOriginalTime(
  dateStr: string,
  originalIso?: string | null
): string {
  if (!dateStr) return originalIso || '';
  if (originalIso && formatLocalDateInput(originalIso) === dateStr) {
    return originalIso;
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return originalIso || dateStr;
  const [y, m, d] = parts;
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
    return originalIso || dateStr;
  }

  const orig = originalIso ? new Date(originalIso) : null;
  const hasValidOrig = orig !== null && !Number.isNaN(orig.getTime());
  const merged = new Date(
    y,
    m - 1,
    d,
    hasValidOrig ? orig.getHours() : 12,
    hasValidOrig ? orig.getMinutes() : 0,
    hasValidOrig ? orig.getSeconds() : 0,
    hasValidOrig ? orig.getMilliseconds() : 0
  );
  return merged.toISOString();
}
