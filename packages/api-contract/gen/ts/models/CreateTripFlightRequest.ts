/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FlightEndpointInput } from './FlightEndpointInput';
export type CreateTripFlightRequest = {
    /**
     * Server trims leading/trailing whitespace.
     */
    displayTitle: string;
    /**
     * Optional flight number. Blank strings are stored as null.
     */
    flightNumber: string | null;
    departure: FlightEndpointInput;
    arrival: FlightEndpointInput;
    passengerParticipantIds: Array<string>;
};
