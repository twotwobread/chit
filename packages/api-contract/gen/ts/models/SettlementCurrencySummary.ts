/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SettlementBalance } from './SettlementBalance';
import type { SettlementTransfer } from './SettlementTransfer';
import type { SupportedCurrency } from './SupportedCurrency';
export type SettlementCurrencySummary = {
    currency: SupportedCurrency;
    totalPaidMinor: number;
    totalShareMinor: number;
    balances: Array<SettlementBalance>;
    suggestedTransfers: Array<SettlementTransfer>;
};

