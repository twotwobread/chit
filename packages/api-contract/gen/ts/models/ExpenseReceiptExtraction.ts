/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseReceiptConfidence } from './ExpenseReceiptConfidence';
import type { ExpenseReceiptLineItemDraft } from './ExpenseReceiptLineItemDraft';
import type { SupportedCurrency } from './SupportedCurrency';
export type ExpenseReceiptExtraction = {
    merchantName: string | null;
    expenseTitle: string | null;
    expenseDate: string | null;
    expenseTime: string | null;
    currency: SupportedCurrency | null;
    totalAmountMinor: number | null;
    taxAmountMinor: number | null;
    serviceChargeMinor: number | null;
    lineItems: Array<ExpenseReceiptLineItemDraft>;
    confidence: ExpenseReceiptConfidence;
    warnings: Array<string>;
};
