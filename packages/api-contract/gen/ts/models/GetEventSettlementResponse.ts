/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SettlementCurrencySummary } from './SettlementCurrencySummary';
import type { SupportedCurrency } from './SupportedCurrency';
export type GetEventSettlementResponse = {
    eventId: string;
    defaultCurrency: SupportedCurrency;
    currencySummaries: Array<SettlementCurrencySummary>;
};
