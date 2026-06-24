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
     * Server-generated arrival timestamp for this itinerary item instance. Null means pending.
     */
    arrivedAt: string | null;
    place: TripPlaceSummary;
};

