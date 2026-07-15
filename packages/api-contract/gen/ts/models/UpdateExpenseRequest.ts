/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
export type UpdateExpenseRequest = {
    amountMinor: number;
    /**
     * Required current trip participant who paid the expense.
     */
    payerParticipantId: string;
    splitPolicy: ExpenseSplitPolicy;
    /**
     * Required only when splitPolicy is equal. Must be omitted for manual.
     */
    participantIds?: Array<string>;
    /**
     * Required only when splitPolicy is manual. Must be omitted for equal.
     */
    splits?: Array<ManualExpenseSplitInput>;
    /**
     * Optional memo. Empty strings are normalized to null by the server.
     */
    memo: string | null;
    /**
     * Optional display title for general expenses. Empty strings are normalized to null by the server.
     */
    title?: string | null;
    /**
     * Same-day schedule item to link, or null to clear the linked place.
     */
    scheduleItemId: string | null;
    /**
     * When provided, updates whether the expense is included in final settlement calculations. Omit to keep the existing value.
     */
    includeInSettlement?: boolean;
};
