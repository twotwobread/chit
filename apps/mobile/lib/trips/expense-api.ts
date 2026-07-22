import {
  OpenAPI,
  TripsService,
  type CreateExpenseReceiptDraftResponse,
  type CreateManualTripPlaceRequest,
  type CreateManualTripPlaceResponse,
  type CreateQuickExpenseRequest,
  type CreateQuickExpenseResponse,
  type CreateTripExpenseRequest,
  type CreateTripExpenseResponse,
  type GetExpenseResponse,
  type ListDayExpensesResponse,
  type ListTripExpensesResponse,
  type OpenExpenseReceiptResponse,
  type ReceiptCaptureMode,
  type ReceiptImageRole,
  type ReceiptOCRTextPart,
  type UpdateExpenseRequest,
  type UpdateExpenseResponse,
  type UploadExpenseReceiptResponse,
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

export async function createManualTripPlace(
  tripId: string,
  request: CreateManualTripPlaceRequest,
): Promise<CreateManualTripPlaceResponse> {
  return runAuthenticatedRequest(() => TripsService.createManualTripPlace(tripId, request));
}

export class ExpenseReceiptUploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ExpenseReceiptUploadError';
    this.status = status;
  }
}

export type ExpenseReceiptDraftImageInput = {
  role: ReceiptImageRole;
  uri: string;
  contentType: string;
  fileName?: string;
};

export async function createExpenseReceiptDraftFromCapture({
  captureMode,
  images,
  ocrTextParts,
  tripId,
}: {
  tripId: string;
  captureMode: ReceiptCaptureMode;
  ocrTextParts: ReceiptOCRTextPart[];
  images: ExpenseReceiptDraftImageInput[];
}): Promise<CreateExpenseReceiptDraftResponse> {
  return receiptMultipartRequest<CreateExpenseReceiptDraftResponse>({
    path: `/trips/${encodeURIComponent(tripId)}/expense-receipt-drafts`,
    captureMode,
    images,
    ocrTextParts,
  });
}

export async function cancelExpenseReceiptDraft(tripId: string, receiptDraftId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.cancelExpenseReceiptDraft(tripId, receiptDraftId));
}

export async function uploadExpenseReceiptBinary({
  contentType,
  expenseId,
  tripId,
  uri,
}: {
  tripId: string;
  expenseId: string;
  uri: string;
  contentType: string;
}): Promise<UploadExpenseReceiptResponse> {
  return receiptBinaryRequest<UploadExpenseReceiptResponse>({
    method: 'PUT',
    path: `/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}/receipt`,
    uri,
    contentType,
  });
}

export async function deleteExpenseReceipt(tripId: string, expenseId: string): Promise<void> {
  return runAuthenticatedRequest(() => TripsService.deleteExpenseReceipt(tripId, expenseId));
}

export async function openExpenseReceipt(tripId: string, expenseId: string): Promise<OpenExpenseReceiptResponse> {
  return runAuthenticatedRequest(() => TripsService.openExpenseReceipt(tripId, expenseId));
}

async function receiptMultipartRequest<T>({
  captureMode,
  images,
  ocrTextParts,
  path,
}: {
  path: string;
  captureMode: ReceiptCaptureMode;
  ocrTextParts: ReceiptOCRTextPart[];
  images: ExpenseReceiptDraftImageInput[];
}): Promise<T> {
  return runAuthenticatedRequest(async () => {
    const token = typeof OpenAPI.TOKEN === 'string' ? OpenAPI.TOKEN : undefined;
    if (!token) {
      throw new ExpenseReceiptUploadError(401, 'missing access token');
    }
    const form = new FormData();
    form.append('captureMode', captureMode);
    form.append('ocrLanguage', 'ko');
    form.append('ocrTextParts', JSON.stringify(ocrTextParts));
    for (const image of images) {
      form.append(receiptImageFieldName(image.role), {
        uri: image.uri,
        name: image.fileName ?? `${image.role}-receipt.jpg`,
        type: image.contentType,
      } as unknown as Blob);
    }
    const response = await fetch(`${OpenAPI.BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });
    if (!response.ok) {
      throw new ExpenseReceiptUploadError(response.status, await response.text().catch(() => 'receipt upload failed'));
    }
    return (await response.json()) as T;
  });
}

function receiptImageFieldName(role: ReceiptImageRole): 'image' | 'headerImage' | 'totalImage' {
  if (role === 'header') {
    return 'headerImage';
  }
  if (role === 'total') {
    return 'totalImage';
  }
  return 'image';
}

async function receiptBinaryRequest<T>({
  contentType,
  method,
  path,
  uri,
}: {
  method: 'POST' | 'PUT';
  path: string;
  uri: string;
  contentType: string;
}): Promise<T> {
  return runAuthenticatedRequest(async () => {
    const token = typeof OpenAPI.TOKEN === 'string' ? OpenAPI.TOKEN : undefined;
    if (!token) {
      throw new ExpenseReceiptUploadError(401, 'missing access token');
    }
    const blob = await (await fetch(uri)).blob();
    const response = await fetch(`${OpenAPI.BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: blob,
    });
    if (!response.ok) {
      throw new ExpenseReceiptUploadError(response.status, await response.text().catch(() => 'receipt upload failed'));
    }
    return (await response.json()) as T;
  });
}
