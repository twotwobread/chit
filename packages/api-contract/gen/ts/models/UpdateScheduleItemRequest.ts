/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NonPlaceScheduleItemCategory } from './NonPlaceScheduleItemCategory';
import type { NonPlaceTransportMode } from './NonPlaceTransportMode';
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
    category?: NonPlaceScheduleItemCategory;
    /**
     * Non-place item title. Empty string is invalid because title is required.
     */
    title?: string;
    /**
     * Non-place memo. Empty string clears the memo.
     */
    memo?: string;
    /**
     * Non-place link. Empty string clears the link.
     */
    link?: string;
    transportMode?: NonPlaceTransportMode;
    /**
     * Transport reference number. Empty string clears the field.
     */
    referenceNumber?: string;
    /**
     * Transport booking reference. Empty string clears the field.
     */
    bookingReference?: string;
    /**
     * Transport origin text. Empty string clears the field.
     */
    originText?: string;
    /**
     * Transport destination text. Empty string clears the field.
     */
    destinationText?: string;
    /**
     * Transport terminal text. Empty string clears the field.
     */
    terminalText?: string;
    /**
     * Transport gate text. Empty string clears the field.
     */
    gateText?: string;
};
