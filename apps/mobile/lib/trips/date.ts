export const tripDateLayoutPattern = /^\d{4}-\d{2}-\d{2}$/;

export function todayString(date = new Date()): string {
  return formatLocalDate(date);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDate(value: string): boolean {
  if (!tripDateLayoutPattern.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

export function monthStringFromDate(date: Date): string {
  return monthString(date.getFullYear(), date.getMonth() + 1);
}

export function monthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function normalizeMonth(month: string, minDate: string): string {
  const minMonth = monthStringFromDate(dateFromString(minDate));
  return month < minMonth ? minMonth : month;
}

export function addMonths(month: string, amount: number): string {
  const date = dateFromString(month);
  return monthStringFromDate(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}
