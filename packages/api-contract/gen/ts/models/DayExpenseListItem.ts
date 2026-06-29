/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayExpenseSplitListItem } from './DayExpenseSplitListItem';
import type { ExpenseAnchorType } from './ExpenseAnchorType';
import type { ExpenseParticipantDisplay } from './ExpenseParticipantDisplay';
import type { ExpensePlaceDisplay } from './ExpensePlaceDisplay';
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { SupportedCurrency } from './SupportedCurrency';
export type DayExpenseListItem = {
    id: string;
    anchorType: ExpenseAnchorType;
    tripDayId: string | null;
    scheduleItemId: string | null;
    expenseDate: string;
    /**
     * User-facing title resolved by the server. For current schedule-item quick expenses this is the linked place/schedule display name or fallback place name.
     */
    displayTitle: string;
    place: ExpensePlaceDisplay | null;
    amountMinor: number;
    currency: SupportedCurrency;
    payer: ExpenseParticipantDisplay;
    splitPolicy: ExpenseSplitPolicy;
    splits: Array<DayExpenseSplitListItem>;
    createdAt: string;
};
