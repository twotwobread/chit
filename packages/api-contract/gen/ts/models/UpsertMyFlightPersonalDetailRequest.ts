/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpsertMyFlightPersonalDetailRequest = {
    /**
     * Server trims; blank strings clear to null.
     */
    reservationNumber: string | null;
    /**
     * Server trims; blank strings clear to null.
     */
    seat: string | null;
    /**
     * Server trims; blank strings clear to null; non-null values must be http or https URLs.
     */
    checkInUrl: string | null;
};
