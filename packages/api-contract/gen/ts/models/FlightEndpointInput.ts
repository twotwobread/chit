/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FlightEndpointInput = {
    /**
     * Server trims leading/trailing whitespace.
     */
    airportText: string;
    /**
     * Optional manually entered airport code. Server trims and uppercases when present.
     */
    airportCode?: string | null;
    /**
     * Airport-local date in YYYY-MM-DD format.
     */
    localDate: string;
    /**
     * Airport-local time in HH:mm 24-hour format.
     */
    localTime: string;
    /**
     * IANA time zone identifier. Abbreviations such as KST or PST are invalid.
     */
    timeZone: string;
};
