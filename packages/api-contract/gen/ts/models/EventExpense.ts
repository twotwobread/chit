/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseCategory } from './ExpenseCategory';
import type { ExpenseKind } from './ExpenseKind';
import type { ExpenseParticipantDisplay } from './ExpenseParticipantDisplay';
import type { ExpenseReceiptSummary } from './ExpenseReceiptSummary';
import type { ExpenseSplit } from './ExpenseSplit';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { SupportedCurrency } from './SupportedCurrency';
export type EventExpense = {
    id: string;
    eventId: string;
    title: string | null;
    displayTitle: string;
    expenseDate: string;
    amountMinor: number;
    currency: SupportedCurrency;
    expenseCategory: ExpenseCategory;
    expenseKind: ExpenseKind;
    payer: ExpenseParticipantDisplay;
    memo: string | null;
    splitPolicy: ExpenseSplitPolicy;
    splits: Array<ExpenseSplit>;
    includeInSettlement: boolean;
    receipt: ExpenseReceiptSummary;
    createdAt: string;
};
