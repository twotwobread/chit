/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Ordered move operation. The server applies moves sequentially inside one transaction. `beforeItemId` and `afterItemId` cannot both be null, and all present ids must be distinct.
 */
export type ReorderDayItineraryMove = {
    /**
     * The itinerary item being moved.
     */
    itemId: string;
    /**
     * The itinerary item that must be immediately before the moved item after this move, or null when moving to the first position.
     */
    beforeItemId: string | null;
    /**
     * The itinerary item that must be immediately after the moved item after this move, or null when moving to the last position.
     */
    afterItemId: string | null;
    /**
     * The moved item's optimistic locking version observed by the client.
     */
    clientVersion: number;
};

