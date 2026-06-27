/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayExpenseSplitListItem } from './DayExpenseSplitListItem';
import type { ExpensePlaceSnapshot } from './ExpensePlaceSnapshot';
import type { SupportedCurrency } from './SupportedCurrency';
export type DayExpenseListItem = {
    id: string;
    place: ExpensePlaceSnapshot;
    amountMinor: number;
    currency: SupportedCurrency;
    payerDisplayName: string;
    splits: Array<DayExpenseSplitListItem>;
    createdAt: string;
};

