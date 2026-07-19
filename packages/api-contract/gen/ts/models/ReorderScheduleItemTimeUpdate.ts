/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Optional schedule time update applied atomically with a Day reorder. Expected times must still match the current row before the update is applied.
 */
export type ReorderScheduleItemTimeUpdate = {
    /**
     * Schedule item whose time range should be updated in the same reorder transaction.
     */
    scheduleItemId: string;
    /**
     * Client-observed current local start time in HH:mm. Null means the item was untimed when observed.
     */
    expectedStartTime: string | null;
    /**
     * Client-observed current local end time in HH:mm. Null means the item had no end time when observed.
     */
    expectedEndTime: string | null;
    /**
     * Target local start time in HH:mm. Null clears both start and end time.
     */
    startTime: string | null;
    /**
     * Target local end time in HH:mm. Must be later than startTime when present.
     */
    endTime: string | null;
};
