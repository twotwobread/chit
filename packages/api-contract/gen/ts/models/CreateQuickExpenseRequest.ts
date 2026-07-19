/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseSplitPolicy } from './ExpenseSplitPolicy';
import type { ManualExpenseSplitInput } from './ManualExpenseSplitInput';
export type CreateQuickExpenseRequest = {
    /**
     * Required schedule item for the selected Day. Must belong to tripId/tripDayId.
     */
    scheduleItemId: string;
    /**
     * Positive amount in currency minor units.
     */
    amountMinor: number;
    /**
     * Active trip participant who paid the expense.
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
     * Whether to include the expense in final settlement calculations. Defaults to true when omitted.
     */
    includeInSettlement?: boolean;
    /**
     * Optional reviewed receipt draft to promote as the saved expense receipt. Must belong to the same trip and authenticated user.
     */
    receiptDraftId?: string | null;
};
