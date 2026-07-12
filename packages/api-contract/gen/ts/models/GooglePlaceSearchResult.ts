/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GooglePlaceSearchPhoto } from './GooglePlaceSearchPhoto';
import type { TripPlaceType } from './TripPlaceType';
export type GooglePlaceSearchResult = {
    googlePlaceId: string;
    displayName: string;
    formattedAddress: string;
    primaryType: string;
    placeType: TripPlaceType;
    primaryTypeDisplayName?: string;
    latitude: number;
    longitude: number;
    rating?: number;
    userRatingCount?: number;
    /**
     * Current opening-hours status when returned by Google Places.
     */
    openNow?: boolean;
    googleMapsUri?: string;
    photo?: GooglePlaceSearchPhoto;
};
