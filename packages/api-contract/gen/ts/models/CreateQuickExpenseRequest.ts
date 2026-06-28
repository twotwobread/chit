/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateQuickExpenseRequest = {
    /**
     * Required itinerary item for the selected Day. Must belong to tripId/date.
     */
    itineraryItemId: string;
    /**
     * Positive amount in currency minor units.
     */
    amountMinor: number;
    /**
     * Active trip participant who paid the expense.
     */
    payerParticipantId: string;
    /**
     * Current accepted trip participants selected as equal split targets.
     */
    participantIds: Array<string>;
};

