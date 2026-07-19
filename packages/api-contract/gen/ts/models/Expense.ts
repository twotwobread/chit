/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseAnchorType } from './ExpenseAnchorType';
import type { ExpenseParticipantDisplay } from './ExpenseParticipantDisplay';
import type { ExpensePlaceDisplay } from './ExpensePlaceDisplay';
import type { ExpenseReceiptSummary } from './ExpenseReceiptSummary';
import type { ExpenseSplit } from './ExpenseSplit';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { SupportedCurrency } from './SupportedCurrency';
export type Expense = {
    id: string;
    tripId: string;
    anchorType: ExpenseAnchorType;
    tripDayId: string | null;
    /**
     * Source schedule item. Present for schedule-item expenses; may become null if later detached to trip-level.
     */
    scheduleItemId: string | null;
    expenseDate: string;
    /**
     * Optional stored title supplied by the user for general expenses.
     */
    title: string | null;
    /**
     * User-facing title resolved by the server.
     */
    displayTitle: string;
    place: ExpensePlaceDisplay | null;
    amountMinor: number;
    currency: SupportedCurrency;
    payer: ExpenseParticipantDisplay;
    memo: string | null;
    splitPolicy: ExpenseSplitPolicy;
    splits: Array<ExpenseSplit>;
    /**
     * Whether this expense is included in final settlement calculations. False means it was settled on-site and remains in history/total spend only.
     */
    includeInSettlement: boolean;
    receipt: ExpenseReceiptSummary;
    createdAt: string;
};
