import type { Href } from 'expo-router';

export function buildNotificationSettleActionPath(tripId: string, expenseId: string): Href {
  return `/trips/${encodeURIComponent(tripId)}/settle?expenseId=${encodeURIComponent(expenseId)}` as Href;
}

export function resolveNotificationActionRoute(actionPath: string | null | undefined): Href | null {
  const raw = actionPath?.trim() ?? '';
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(raw, 'ium://app');
    const match = url.pathname.match(/^\/trips\/([^/]+)\/settle$/);
    if (!match) {
      return null;
    }
    const tripId = decodeURIComponent(match[1] ?? '').trim();
    const expenseId = url.searchParams.get('expenseId')?.trim() ?? '';
    if (!tripId || !expenseId) {
      return null;
    }
    return buildNotificationSettleActionPath(tripId, expenseId);
  } catch {
    return null;
  }
}
