/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FlightBoardingPassSummary } from './FlightBoardingPassSummary';
export type MyFlightPersonalDetail = {
    reservationNumber: string | null;
    seat: string | null;
    /**
     * Optional http/https check-in or reservation URL.
     */
    checkInUrl: string | null;
    boardingPass: FlightBoardingPassSummary;
};
