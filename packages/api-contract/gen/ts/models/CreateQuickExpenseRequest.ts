/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseCategory } from './ExpenseCategory';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
import type { SupportedCurrency } from './SupportedCurrency';
export type CreateQuickExpenseRequest = {
    /**
     * Required schedule item for the selected Day. Must belong to tripId/tripDayId.
     */
    scheduleItemId: string;
    /**
     * Positive amount in currency minor units.
     */
    amountMinor: number;
    /**
     * Expense currency. Defaults to the trip default currency when omitted.
     */
    currency?: SupportedCurrency;
    /**
     * Expense category used for settlement analytics. Defaults to linked place type when available, otherwise etc.
     */
    expenseCategory?: ExpenseCategory;
    /**
     * Active trip participant who paid the expense.
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
     * Whether to include the expense in final settlement calculations. Defaults to true when omitted.
     */
    includeInSettlement?: boolean;
    /**
     * Optional reviewed receipt draft to promote as the saved expense receipt. Must belong to the same trip and authenticated user.
     */
    receiptDraftId?: string | null;
};
