/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseCategory } from './ExpenseCategory';
import type { ExpenseKind } from './ExpenseKind';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
import type { SupportedCurrency } from './SupportedCurrency';
export type CreateEventExpenseRequest = {
    /**
     * Optional display title. Required when no event place is available.
     */
    title: string | null;
    expenseDate: string;
    amountMinor: number;
    /**
     * Defaults to the event default currency when omitted.
     */
    currency?: SupportedCurrency;
    /**
     * Defaults to etc when omitted.
     */
    expenseCategory?: ExpenseCategory;
    /**
     * Defaults to regular when omitted.
     */
    expenseKind?: ExpenseKind;
    /**
     * Current event participant who paid the expense.
     */
    payerParticipantId: string;
    splitPolicy: ExpenseSplitPolicy;
    /**
     * Required only when splitPolicy is equal. Event participant IDs.
     */
    participantIds?: Array<string>;
    /**
     * Required only when splitPolicy is manual. Participant IDs are event participant IDs.
     */
    splits?: Array<ManualExpenseSplitInput>;
    memo?: string | null;
    /**
     * Defaults to true for regular expenses and false for public-fund expenses.
     */
    includeInSettlement?: boolean;
};
