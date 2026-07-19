/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
export type NotificationSnapshot = {
    tripId: string;
    expenseId: string;
    actorDisplayName: string;
    expenseTitle: string;
    amountMinor: number;
    currency: SupportedCurrency;
};
