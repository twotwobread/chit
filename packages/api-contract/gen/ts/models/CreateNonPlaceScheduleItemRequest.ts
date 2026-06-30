/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NonPlaceScheduleItemCategory } from './NonPlaceScheduleItemCategory';
import type { NonPlaceTransportMode } from './NonPlaceTransportMode';
export type CreateNonPlaceScheduleItemRequest = {
    category: NonPlaceScheduleItemCategory;
    title: string;
    startTime?: string;
    endTime?: string;
    memo?: string;
    link?: string;
    transportMode?: NonPlaceTransportMode;
    referenceNumber?: string;
    bookingReference?: string;
    originText?: string;
    destinationText?: string;
    terminalText?: string;
    gateText?: string;
};
