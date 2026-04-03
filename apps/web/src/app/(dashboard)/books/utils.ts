import { formatVND } from '@amounzer/shared';
import type { DateRange } from './types';

// ── Date Helpers ─────────────────────────────────────────────────────────────

export function getDefaultDateRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

// ── Amount Formatting ────────────────────────────────────────────────────────

/**
 * Format amount - returns empty string for zero/null values
 */
export function fmtAmt(val: number | undefined | null): string {
  if (val == null || val === 0) return '';
  return formatVND(val);
}

/**
 * Format balance - shows dash for zero, handles negative values
 */
export function fmtBal(val: number): string {
  if (val === 0) return '—';
  return (val < 0 ? '-' : '') + formatVND(Math.abs(val));
}

// ── Type Coercion ────────────────────────────────────────────────────────────

export function toNumber(val: string | number | undefined | null): number {
  return Number(val ?? 0) || 0;
}
