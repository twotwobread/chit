/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScheduleItem } from './ScheduleItem';
import type { TripDay } from './TripDay';
export type CreateGooglePlaceScheduleItemsBatchResponse = {
    day: TripDay;
    /**
     * Schedule items created by this batch, in the same order as request items.
     */
    createdScheduleItems: Array<ScheduleItem>;
    /**
     * Latest server source-of-truth schedule items for the selected day, ordered by schedule order/rank.
     */
    scheduleItems: Array<ScheduleItem>;
};
