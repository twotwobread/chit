import {
  TripsService,
  type CreateQuickExpenseRequest,
  type CreateQuickExpenseResponse,
  type GetExpenseResponse,
  type ListDayExpensesResponse,
  type UpdateExpenseRequest,
  type UpdateExpenseResponse,
} from '@i-um/api-contract';

import { getMeWithRefresh } from '../auth/client';

export async function listDayExpenses(tripId: string, tripDayId: string): Promise<ListDayExpensesResponse> {
  await getMeWithRefresh();
  return TripsService.listDayExpenses(tripId, tripDayId);
}

export async function getDayExpense(tripId: string, tripDayId: string, expenseId: string): Promise<GetExpenseResponse> {
  await getMeWithRefresh();
  return TripsService.getDayExpense(tripId, tripDayId, expenseId);
}

export async function updateExpense(
  tripId: string,
  tripDayId: string,
  expenseId: string,
  request: UpdateExpenseRequest,
): Promise<UpdateExpenseResponse> {
  await getMeWithRefresh();
  return TripsService.updateExpense(tripId, tripDayId, expenseId, request);
}

export async function deleteExpense(tripId: string, tripDayId: string, expenseId: string): Promise<void> {
  await getMeWithRefresh();
  return TripsService.deleteExpense(tripId, tripDayId, expenseId);
}

export async function createQuickExpense(
  tripId: string,
  date: string,
  request: CreateQuickExpenseRequest,
): Promise<CreateQuickExpenseResponse> {
  await getMeWithRefresh();
  return TripsService.createQuickExpense(tripId, date, request);
}
