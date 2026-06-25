/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripPlaceSummary } from './TripPlaceSummary';
export type DayItineraryItem = {
    id: string;
    itemOrder: number;
    version: number;
    isLodging: boolean;
    /**
     * Server-generated arrival timestamp for this itinerary item instance. Null means pending when skippedAt is also null.
     */
    arrivedAt: string | null;
    /**
     * Server-generated skip timestamp for this itinerary item instance. Null means the item is not currently skipped.
     */
    skippedAt: string | null;
    place: TripPlaceSummary;
};

