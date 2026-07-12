/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DestinationProvider } from './DestinationProvider';
export type TripDestinationInput = {
    cityName: string;
    countryName: string;
    countryCode: string;
    displayName: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    provider: DestinationProvider;
    providerPlaceId: string;
};
