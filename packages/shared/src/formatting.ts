/**
 * Format a number as VND currency (no decimals, comma thousand separator).
 * E.g., 1000000 → "1,000,000"
 */
export function formatVND(amount: number | bigint | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return '0';
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
 * Format date in Vietnamese legal format: "Ngày ... tháng ... năm ..."
 */
export function formatDateVNLegal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `Ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * Format a Vietnamese number (comma as thousand separator, dot as decimal).
 * E.g., 1234567.89 → "1,234,567.89"
 */
export function formatNumberVN(value: number, decimals = 0): string {
  const parts = value.toFixed(decimals).split('.');
  const intPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decimals > 0 && parts[1]) {
    return `${intPart}.${parts[1]}`;
  }
  return intPart;
}

/**
 * Parse a VND-formatted string back to a number.
 * E.g., "1,000,000" → 1000000
 */
export function parseVND(formatted: string): number {
  return parseInt(formatted.replace(/,/g, ''), 10) || 0;
}

/**
 * Format a number as VND, but return "-" if zero or null.
 * E.g., 1000000 → "1,000,000", 0 → "-"
 */
export function formatVNDOrDash(amount: number | bigint | string | null | undefined): string {
  if (amount == null) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num) || num === 0) return '-';
  return formatVND(num);
}

// Vietnamese number words
const ONES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const TENS_UNITS = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
const SCALE_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

/**
 * Convert a 3-digit group to Vietnamese words
 */
function readThreeDigits(num: number, hasHigherUnit: boolean): string {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const ones = num % 10;
  
  const parts: string[] = [];
  
  // Hundreds
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} trăm`);
  } else if (hasHigherUnit && (tens > 0 || ones > 0)) {
    parts.push('không trăm');
  }
  
  // Tens
  if (tens > 1) {
    parts.push(TENS_UNITS[tens]!);
    if (ones === 1) {
      parts.push('mốt');
    } else if (ones === 5) {
      parts.push('lăm');
    } else if (ones > 0) {
      parts.push(ONES[ones]!);
    }
  } else if (tens === 1) {
    parts.push('mười');
    if (ones === 5) {
      parts.push('lăm');
    } else if (ones > 0) {
      parts.push(ONES[ones]!);
    }
  } else if (ones > 0) {
    if (hundreds > 0 || hasHigherUnit) {
      parts.push(`lẻ ${ONES[ones]}`);
    } else {
      parts.push(ONES[ones]!);
    }
  }
  
  return parts.join(' ');
}

/**
 * Convert a number to Vietnamese words (for currency amounts).
 * E.g., 12500000 → "Mười hai triệu năm trăm nghìn đồng chẵn"
 * 
 * @param amount - The numeric amount
 * @param currency - Currency name suffix (default: "đồng")
 * @returns Vietnamese text representation
 */
export function numberToVietnameseWords(
  amount: number | bigint | string,
  currency: string = 'đồng'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  
  if (isNaN(num) || num === 0) {
    return `Không ${currency} chẵn`;
  }
  
  if (num < 0) {
    return `Âm ${numberToVietnameseWords(-num, currency)}`;
  }
  
  // Round to integer for VND
  const intNum = Math.round(num);
  
  // Split into 3-digit groups from right to left
  const groups: number[] = [];
  let remaining = intNum;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  
  // Convert each group to words
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]!;
    if (group === 0) continue;
    
    const hasHigherUnit = groups.slice(i + 1).some(g => g > 0);
    const words = readThreeDigits(group, hasHigherUnit);
    if (words) {
      const unit = SCALE_UNITS[i] || '';
      parts.push(unit ? `${words} ${unit}` : words);
    }
  }
  
  if (parts.length === 0) {
    return `Không ${currency} chẵn`;
  }
  
  // Capitalize first letter
  const result = parts.join(' ');
  const capitalizedResult = result.charAt(0).toUpperCase() + result.slice(1);
  
  return `${capitalizedResult} ${currency} chẵn`;
}
