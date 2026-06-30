/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NonPlaceScheduleItemCategory } from './NonPlaceScheduleItemCategory';
import type { NonPlaceTransportMode } from './NonPlaceTransportMode';
export type NonPlaceScheduleItemDetails = {
    category: NonPlaceScheduleItemCategory;
    title: string;
    memo: string | null;
    link: string | null;
    transportMode: NonPlaceTransportMode | null;
    referenceNumber: string | null;
    bookingReference: string | null;
    originText: string | null;
    destinationText: string | null;
    terminalText: string | null;
    gateText: string | null;
};
