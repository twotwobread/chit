/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MySettlementDirection } from './MySettlementDirection';
import type { SupportedCurrency } from './SupportedCurrency';
export type MySettlementCurrencySummary = {
    currency: SupportedCurrency;
    direction: MySettlementDirection;
    /**
     * Absolute non-zero current-user settlement amount in minor units.
     */
    netMinor: number;
};
