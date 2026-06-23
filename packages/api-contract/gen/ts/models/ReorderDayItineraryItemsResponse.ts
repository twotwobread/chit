/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayItineraryItem } from './DayItineraryItem';
import type { TripDay } from './TripDay';
export type ReorderDayItineraryItemsResponse = {
    day: TripDay;
    /**
     * Latest server source-of-truth itinerary items ordered by rank.
     */
    items: Array<DayItineraryItem>;
};

