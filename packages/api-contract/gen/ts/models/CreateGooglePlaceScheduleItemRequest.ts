/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateGooglePlaceScheduleItemRequest = {
    googlePlaceId: string;
    /**
     * Set true only after the user confirms adding the same Google place to the same Day again.
     */
    duplicateConfirmed: boolean;
    /**
     * Required schedule title. Defaults from the selected place name on mobile but is stored separately from the place snapshot.
     */
    title: string;
    /**
     * Optional local start time in HH:mm. Omit or send empty string to save as untimed/order-only.
     */
    startTime?: string;
    /**
     * Optional local end time in HH:mm. Requires startTime and must be later than startTime.
     */
    endTime?: string;
    /**
     * Optional place-backed schedule memo. Empty strings are normalized to null by the server.
     */
    memo?: string;
};
