/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayExpenseListItem } from './DayExpenseListItem';
import type { TripExpenseDayListItem } from './TripExpenseDayListItem';
export type ListTripExpensesResponse = {
    /**
     * Trip-level expenses with no related Day or schedule item.
     */
    tripExpenses: Array<DayExpenseListItem>;
    days: Array<TripExpenseDayListItem>;
};
