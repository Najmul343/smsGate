/**
 * Normalizes a raw phone input string to standard +91 Indian format or international format.
 * - strips `.0` suffix from Excel float strings
 * - removes spaces, dashes, parentheses, commas, dots
 * - preserves explicit leading '+' for international numbers
 * - automatically formats Indian 10-digit numbers (starting with 6, 7, 8, 9) to +91...
 * - handles 11-digit numbers starting with 0 (e.g. 07903123456 -> +917903123456)
 * - handles 12-digit numbers starting with 91 (e.g. 917903123456 -> +917903123456)
 * - prevents false +7 Russian prefixing on Indian numbers starting with 7
 */
export function normalizePhone(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  let num = String(raw).trim();
  if (!num) return null;

  // Strip .0 suffix from Excel float representations (e.g. 919876543210.0 or 7903123456.0)
  if (num.endsWith('.0')) {
    num = num.slice(0, -2);
  }

  // Preserve leading '+' if explicitly provided in raw input
  const hasPlus = num.startsWith('+');

  // Strip spaces, dashes, parens, quotes, commas, dots
  num = num.replace(/[\s\-\(\)"'\,\.]+/g, '');
  if (!num) return null;

  // Extract digits only
  const digits = num.replace(/\D/g, '');
  if (!digits) return null;

  // CASE A: User explicitly provided '+' at the beginning (e.g. +919876543210 or +1234567890)
  if (hasPlus) {
    if (digits.length >= 10 && digits.length <= 15) {
      return '+' + digits;
    }
    return null;
  }

  // CASE B: User did NOT provide '+' (e.g. standard paste, Excel upload)
  // 1. 13 digits starting with 091 (e.g. 0917903123456)
  if (digits.length === 13 && digits.startsWith('091')) {
    const core = digits.slice(3);
    if (core.length === 10) return '+91' + core;
  }

  // 2. 12 digits starting with 91 (e.g. 917903123456 or 916123456789)
  if (digits.length === 12 && digits.startsWith('91')) {
    const core = digits.slice(2);
    if (core.length === 10) return '+91' + core;
  }

  // 3. 11 digits starting with 0 (e.g. 07903123456 or 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    const core = digits.slice(1);
    if (core.length === 10) return '+91' + core;
  }

  // 4. Standard 10-digit Indian phone number (starts with 6, 7, 8, 9)
  if (digits.length === 10) {
    return '+91' + digits;
  }

  // 5. 11 digits starting with 6, 7, 8, 9 (e.g. 79031234567) -> format as +91 + first 10 digits
  if (digits.length === 11 && (digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('8') || digits.startsWith('9'))) {
    return '+91' + digits.slice(0, 10);
  }

  // 6. 12 to 15 digits starting with 6, 7, 8, 9 without +
  if (digits.length > 10 && digits.length <= 15 && (digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('8') || digits.startsWith('9'))) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return '+91' + last10;
    }
    return '+91' + digits.slice(0, 10);
  }

  // 7. Generic fallback for other international numbers without + (10 to 15 digits)
  if (digits.length >= 10 && digits.length <= 15) {
    if (digits.startsWith('7')) {
      // If it starts with 7 without +, it is an Indian mobile number starting with 7
      return '+91' + digits.slice(0, 10);
    }
    return '+' + digits;
  }

  return null;
}

