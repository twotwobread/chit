/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateExpenseRequest = {
    amountMinor: number;
    /**
     * Required current trip participant who paid the expense.
     */
    payerParticipantId: string;
    /**
     * Current accepted trip participants selected as equal split targets.
     */
    participantIds: Array<string>;
    /**
     * Optional memo. Empty strings are normalized to null by the server.
     */
    memo: string | null;
    /**
     * Same-day schedule item to link, or null to clear the linked place.
     */
    scheduleItemId: string | null;
};

