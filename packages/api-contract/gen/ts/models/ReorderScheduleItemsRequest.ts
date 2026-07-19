/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReorderDayScheduleMove } from './ReorderDayScheduleMove';
import type { ReorderScheduleItemTimeUpdate } from './ReorderScheduleItemTimeUpdate';
export type ReorderScheduleItemsRequest = {
    /**
     * Ordered same-Day move operations. Applying them sequentially must produce the client's final local order.
     */
    moves: Array<ReorderDayScheduleMove>;
    /**
     * Optional time updates to apply atomically after the reorder moves. Used by timed-range drag reorder to preserve item durations and existing gaps.
     */
    timeUpdates?: Array<ReorderScheduleItemTimeUpdate>;
};
