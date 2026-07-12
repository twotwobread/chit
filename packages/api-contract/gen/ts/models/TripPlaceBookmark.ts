/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripPlaceSummary } from './TripPlaceSummary';
import type { TripPlaceType } from './TripPlaceType';
export type TripPlaceBookmark = {
    id: string;
    tripId: string;
    category: TripPlaceType;
    place: TripPlaceSummary;
    createdAt: string;
    updatedAt: string;
};
