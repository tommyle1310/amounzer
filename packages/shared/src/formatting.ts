/**
 * Format a number as VND currency (no decimals, dot thousand separator).
 * E.g., 1000000 → "1.000.000"
 */
export function formatVND(amount: number | bigint | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return '0';
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Format a number as VND with currency suffix.
 * E.g., 1000000 → "1.000.000 ₫"
 */
export function formatVNDWithSymbol(amount: number | bigint | string): string {
  return `${formatVND(amount)} ₫`;
}

/**
 * Format a Date to Vietnamese date format: dd/MM/yyyy
 */
export function formatDateVN(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a Vietnamese number (dot as thousand separator, comma as decimal).
 * E.g., 1234567.89 → "1.234.567,89"
 */
export function formatNumberVN(value: number, decimals = 0): string {
  const parts = value.toFixed(decimals).split('.');
  const intPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (decimals > 0 && parts[1]) {
    return `${intPart},${parts[1]}`;
  }
  return intPart;
}

/**
 * Parse a VND-formatted string back to a number.
 * E.g., "1.000.000" → 1000000
 */
export function parseVND(formatted: string): number {
  return parseInt(formatted.replace(/\./g, ''), 10) || 0;
}
