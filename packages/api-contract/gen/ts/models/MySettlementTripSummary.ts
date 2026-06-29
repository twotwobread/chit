/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MySettlementCurrencySummary } from './MySettlementCurrencySummary';
import type { SupportedCurrency } from './SupportedCurrency';
export type MySettlementTripSummary = {
    tripId: string;
    tripName: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    currencySummaries: Array<MySettlementCurrencySummary>;
};
