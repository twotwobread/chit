/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseReceiptConfidence } from './ExpenseReceiptConfidence';
import type { ExpenseReceiptLineItemDraft } from './ExpenseReceiptLineItemDraft';
import type { SupportedCurrency } from './SupportedCurrency';
export type ExpenseReceiptExtraction = {
    merchantName: string | null;
    /**
     * Merchant/business address from the receipt when present. Does not imply a saved TripPlace.
     */
    merchantAddress: string | null;
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
    /**
     * Suggested trip place name for explicit user confirmation. Never auto-register.
     */
    placeCandidateName: string | null;
    /**
     * Suggested trip place address for explicit user confirmation. Never auto-register.
     */
    placeCandidateAddress: string | null;
    /**
     * Confidence for the place candidate only.
     */
    placeCandidateConfidence: ExpenseReceiptConfidence | null;
    /**
     * Candidate-specific warnings, for example when address appears to be a registered business address.
     */
    placeCandidateWarnings: Array<string>;
};
