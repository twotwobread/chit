/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReorderDayScheduleMove } from './ReorderDayScheduleMove';
export type ReorderScheduleItemsRequest = {
    /**
     * Ordered same-Day move operations. Applying them sequentially must produce the client's final local order.
     */
    moves: Array<ReorderDayScheduleMove>;
};

