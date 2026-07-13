/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FlightImageContentType } from './FlightImageContentType';
export type OpenMyFlightBoardingPassResponse = {
    /**
     * Short-lived signed URL. Clients must not persist it.
     */
    url: string;
    expiresAt: string;
    contentType: FlightImageContentType;
    byteSize: number;
};
