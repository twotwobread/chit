/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripPlaceType } from './TripPlaceType';
export type UpdateScheduleItemRequest = {
    name?: string;
    address?: string;
    placeType?: TripPlaceType;
    /**
     * Optional local start time in HH:mm. Empty string clears start and end time; absent leaves unchanged.
     */
    startTime?: string;
    /**
     * Optional local end time in HH:mm. Empty string clears end time; absent leaves unchanged.
     */
    endTime?: string;
    /**
     * Place-backed schedule memo. Empty string clears the memo.
     */
    memo?: string;
};
