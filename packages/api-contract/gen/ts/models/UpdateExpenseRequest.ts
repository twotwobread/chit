/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseCategory } from './ExpenseCategory';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
import type { SupportedCurrency } from './SupportedCurrency';
export type UpdateExpenseRequest = {
    amountMinor: number;
    /**
     * Required current trip participant who paid the expense.
     */
    payerParticipantId: string;
    splitPolicy: ExpenseSplitPolicy;
    /**
     * Required only when splitPolicy is equal. Must be omitted for manual.
     */
    participantIds?: Array<string>;
    /**
     * Required only when splitPolicy is manual. Must be omitted for equal.
     */
    splits?: Array<ManualExpenseSplitInput>;
    /**
     * Optional memo. Empty strings are normalized to null by the server.
     */
    memo: string | null;
    /**
     * Optional display title for general expenses. Empty strings are normalized to null by the server.
     */
    title?: string | null;
    /**
     * Same-day schedule item to link, or null to use tripPlaceId or clear the schedule link. When present, its place is authoritative.
     */
    scheduleItemId: string | null;
    /**
     * Trip-level place to link when scheduleItemId is null. For Day expense updates, null clears the linked place. For trip-level updates, omit or null to keep the existing linked place in this version.
     */
    tripPlaceId: string | null;
    /**
     * When provided, replaces the expense currency. Amount and split minor units are interpreted in this currency without FX conversion. Omit to keep the existing value.
     */
    currency?: SupportedCurrency;
    /**
     * When provided, replaces the expense category used for settlement analytics and row markers. Omit to keep the existing value.
     */
    expenseCategory?: ExpenseCategory;
    /**
     * When provided, updates whether the expense is included in final settlement calculations. Omit to keep the existing value.
     */
    includeInSettlement?: boolean;
};
