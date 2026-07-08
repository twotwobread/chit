/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GooglePlaceSearchPhoto } from './GooglePlaceSearchPhoto';
export type GooglePlaceSearchResult = {
    googlePlaceId: string;
    displayName: string;
    formattedAddress: string;
    primaryType: string;
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
