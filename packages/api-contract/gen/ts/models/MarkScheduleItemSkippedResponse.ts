/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScheduleItem } from './ScheduleItem';
import type { TripDay } from './TripDay';
export type MarkScheduleItemSkippedResponse = {
    day: TripDay;
    scheduleItem: ScheduleItem;
    /**
     * Latest server source-of-truth schedule items for the selected day, ordered by schedule order/rank.
     */
    scheduleItems: Array<ScheduleItem>;
};

