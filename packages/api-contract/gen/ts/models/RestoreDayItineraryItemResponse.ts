/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DayItineraryItem } from './DayItineraryItem';
import type { TripDay } from './TripDay';
export type RestoreDayItineraryItemResponse = {
    day: TripDay;
    item: DayItineraryItem;
    /**
     * Latest server source-of-truth itinerary items for the selected day, ordered by itinerary order/rank.
     */
    items: Array<DayItineraryItem>;
};

