/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoutablePlace } from './RoutablePlace';
import type { TripPlaceType } from './TripPlaceType';
export type TripPlaceSummary = {
    id: string;
    name: string;
    placeType: TripPlaceType;
    address: string;
    routablePlace: RoutablePlace | null;
};
