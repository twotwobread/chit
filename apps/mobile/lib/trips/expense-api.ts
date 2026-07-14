import {
  TripsService,
  type CreateQuickExpenseRequest,
  type CreateQuickExpenseResponse,
  type CreateTripExpenseRequest,
  type CreateTripExpenseResponse,
  type GetExpenseResponse,
  type ListDayExpensesResponse,
  type ListTripExpensesResponse,
  type UpdateExpenseRequest,
  type UpdateExpenseResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function listDayExpenses(tripId: string, tripDayId: string): Promise<ListDayExpensesResponse> {
  return runAuthenticatedRequest(() => TripsService.listDayExpenses(tripId, tripDayId));
}

export async function listTripExpenses(tripId: string): Promise<ListTripExpensesResponse> {
  return runAuthenticatedRequest(() => TripsService.listTripExpenses(tripId));
}

export async function getDayExpense(tripId: string, tripDayId: string, expenseId: string): Promise<GetExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.getDayExpense(tripId, tripDayId, expenseId));
}

export async function getTripExpense(tripId: string, expenseId: string): Promise<GetExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.getTripExpense(tripId, expenseId));
}

export async function updateExpense(
  tripId: string,
  tripDayId: string,
  expenseId: string,
  request: UpdateExpenseRequest,
): Promise<UpdateExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.updateExpense(tripId, tripDayId, expenseId, request));
}

export async function deleteExpense(tripId: string, tripDayId: string, expenseId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.deleteExpense(tripId, tripDayId, expenseId));
}

export async function updateTripExpense(
  tripId: string,
  expenseId: string,
  request: UpdateExpenseRequest,
): Promise<UpdateExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.updateTripExpense(tripId, expenseId, request));
}

export async function deleteTripExpense(tripId: string, expenseId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.deleteTripExpense(tripId, expenseId));
}

export async function createQuickExpense(
  tripId: string,
  date: string,
  request: CreateQuickExpenseRequest,
): Promise<CreateQuickExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.createQuickExpense(tripId, date, request));
}

export async function createTripExpense(
  tripId: string,
  request: CreateTripExpenseRequest,
): Promise<CreateTripExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.createTripExpense(tripId, request));
}
