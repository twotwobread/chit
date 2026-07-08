/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GooglePlacePhotoAttribution } from './GooglePlacePhotoAttribution';
export type GooglePlaceSearchPhoto = {
    /**
     * Short-lived server-issued token for the photo proxy endpoint. Clients must not persist it.
     */
    token: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions: Array<GooglePlacePhotoAttribution>;
};
