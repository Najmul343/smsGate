/**
 * Normalizes a raw phone input string to standard +91 Indian format or international format.
 * Exactly matches the Python Streamlit `normalize(raw)` function logic:
 * - strips `.0` suffix from Excel float strings
 * - removes spaces and dashes
 * - if starts with +91 => returns as is
 * - if starts with 91 (12 digits) => returns +91...
 * - if 10 digits => returns +91...
 */
export function normalizePhone(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  let num = String(raw).trim();
  if (num.endsWith('.0')) {
    num = num.slice(0, -2);
  }
  num = num.replace(/\s+/g, '').replace(/-/g, '');

  if (num.startsWith('+91')) {
    return num;
  } else if (num.startsWith('91') && num.length === 12) {
    return '+' + num;
  } else if (num.length === 10 && /^\d+$/.test(num)) {
    return '+91' + num;
  } else if (num.length >= 10 && num.length <= 15) {
    // If it already has a '+' or looks valid
    return num.startsWith('+') ? num : '+' + num;
  }
  return null;
}
