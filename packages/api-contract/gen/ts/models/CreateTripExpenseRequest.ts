/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseCategory } from './ExpenseCategory';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
import type { SupportedCurrency } from './SupportedCurrency';
export type CreateTripExpenseRequest = {
    /**
     * Optional display title. Required when no schedule item is selected.
     */
    title: string | null;
    /**
     * Actual payment/business date. It may be outside the trip range.
     */
    expenseDate: string;
    /**
     * Optional related Day. If scheduleItemId is present, the server derives and validates the Day from the schedule item.
     */
    tripDayId: string | null;
    /**
     * Optional related schedule item.
     */
    scheduleItemId: string | null;
    amountMinor: number;
    /**
     * Expense currency. Defaults to the trip default currency when omitted.
     */
    currency?: SupportedCurrency;
    /**
     * Expense category used for settlement analytics. Defaults to linked place type when available, otherwise etc.
     */
    expenseCategory?: ExpenseCategory;
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
    memo: string | null;
    /**
     * Whether to include the expense in final settlement calculations. Defaults to true when omitted.
     */
    includeInSettlement?: boolean;
    /**
     * Optional reviewed receipt draft to promote as the saved expense receipt. Must belong to the same trip and authenticated user.
     */
    receiptDraftId?: string | null;
};
