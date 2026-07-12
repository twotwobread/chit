/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PlaceScheduleItemDetails } from './PlaceScheduleItemDetails';
import type { ScheduleItemType } from './ScheduleItemType';
import type { TripPlaceSummary } from './TripPlaceSummary';
export type ScheduleItem = {
    id: string;
    itemOrder: number;
    version: number;
    itemType: ScheduleItemType;
    isLodging: boolean;
    /**
     * Optional local start time in HH:mm. Null means order-only/untimed.
     */
    startTime: string | null;
    /**
     * Optional local end time in HH:mm. Must be later than startTime when present.
     */
    endTime: string | null;
    /**
     * Server-generated arrival timestamp for this schedule item instance. Null means pending when skippedAt is also null.
     */
    arrivedAt: string | null;
    /**
     * Server-generated skip timestamp for this schedule item instance. Null means the item is not currently skipped.
     */
    skippedAt: string | null;
    place: TripPlaceSummary;
    placeSchedule: PlaceScheduleItemDetails | null;
};
