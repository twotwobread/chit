/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScheduleItem } from './ScheduleItem';
import type { TripDay } from './TripDay';
export type MoveScheduleItemToDayResponse = {
    sourceDay: TripDay;
    /**
     * Latest source Day schedule items after the move, ordered by rank.
     */
    sourceScheduleItems: Array<ScheduleItem>;
    targetDay: TripDay;
    /**
     * Latest target Day schedule items after the move, ordered by rank.
     */
    targetScheduleItems: Array<ScheduleItem>;
    movedScheduleItem: ScheduleItem;
};
