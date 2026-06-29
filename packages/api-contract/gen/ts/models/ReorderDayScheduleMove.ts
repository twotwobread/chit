/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Ordered move operation. The server applies moves sequentially inside one transaction. `beforeScheduleItemId` and `afterScheduleItemId` cannot both be null, and all present ids must be distinct.
 */
export type ReorderDayScheduleMove = {
    /**
     * The schedule item being moved.
     */
    scheduleItemId: string;
    /**
     * The schedule item that must be immediately before the moved item after this move, or null when moving to the first position.
     */
    beforeScheduleItemId: string | null;
    /**
     * The schedule item that must be immediately after the moved item after this move, or null when moving to the last position.
     */
    afterScheduleItemId: string | null;
    /**
     * The moved item's optimistic locking version observed by the client.
     */
    clientVersion: number;
};
