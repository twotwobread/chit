/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MoveScheduleItemToDayRequest = {
    /**
     * Target active trip Day id. Must belong to the same trip and differ from the source Day.
     */
    targetTripDayId: string;
    /**
     * The schedule item's optimistic locking version observed by the client.
     */
    clientVersion: number;
};
