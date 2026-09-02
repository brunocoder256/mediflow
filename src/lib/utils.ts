import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names with clsx.
 *
 * @example
 * ```ts
 * cn('px-4 py-2', isActive && 'bg-blue-500', className);
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string or Date object into a localized display string.
 *
 * @param date - ISO 8601 string or Date instance.
 * @param options - Optional `Intl.DateTimeFormatOptions` overrides.
 * @returns Formatted date string (e.g. "Sep 2, 2026").
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Formats a numeric value as currency.
 *
 * @param amount - The amount to format.
 * @param currency - ISO 4217 currency code (default: "USD").
 * @returns Formatted currency string (e.g. "$1,234.56").
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a unique identifier (UUID v4).
 *
 * Useful as a client-side fallback when a database-generated ID is not needed.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
