import type { ListTripExpensesResponse } from '@i-um/api-contract';

export const EXPENSE_SEARCH_QUERY_MAX_LENGTH = 80;

export type ExpenseSearchEmptyState = {
  title: string;
  helper: string;
};

export type ExpenseSearchStatus = {
  label: string;
  helper: string;
};

export function normalizeTripExpenseSearchQuery(value: string): string {
  return value.trim();
}

export function hasTripExpenseRows(response: Pick<ListTripExpensesResponse, 'tripExpenses' | 'days'>): boolean {
  if (response.tripExpenses.length > 0) {
    return true;
  }
  return response.days.some((day) => day.expenses.length > 0);
}

export function buildExpenseSearchEmptyState(query: string): ExpenseSearchEmptyState {
  const normalizedQuery = normalizeTripExpenseSearchQuery(query);
  return {
    title: normalizedQuery ? `“${normalizedQuery}” 장부 기록이 없어요.` : '일치하는 장부 기록이 없어요.',
    helper: '기록명, 장소, 메모, 영수증 품목을 다른 말로 찾아보세요.',
  };
}

export function buildExpenseSearchStatus({
  hasResults,
  isSearching,
  query,
}: {
  query: string;
  isSearching: boolean;
  hasResults: boolean;
}): ExpenseSearchStatus | null {
  const normalizedQuery = normalizeTripExpenseSearchQuery(query);
  if (!normalizedQuery) {
    if (!isSearching) {
      return null;
    }
    return {
      label: '전체 장부 새로고침 중...',
      helper: '최신 장부 기록을 다시 확인하고 있어요.',
    };
  }
  if (isSearching) {
    return {
      label: '장부 검색 중...',
      helper: `“${normalizedQuery}” 장부 기록을 찾는 중이에요.`,
    };
  }
  if (hasResults) {
    return {
      label: `“${normalizedQuery}” 장부 기록`,
      helper: '일치하는 기록만 보여줘요.',
    };
  }
  return null;
}
