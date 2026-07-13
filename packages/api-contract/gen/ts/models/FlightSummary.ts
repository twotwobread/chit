/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FlightEndpoint } from './FlightEndpoint';
import type { FlightPassenger } from './FlightPassenger';
import type { MyFlightPersonalDetail } from './MyFlightPersonalDetail';
export type FlightSummary = {
    id: string;
    displayTitle: string;
    flightNumber: string | null;
    departure: FlightEndpoint;
    arrival: FlightEndpoint;
    passengers: Array<FlightPassenger>;
    /**
     * Current passenger's private detail only. Other passengers' private details are never returned.
     */
    myPersonalDetail: MyFlightPersonalDetail | null;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
};
