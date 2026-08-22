/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TripMeetingContextMode } from './TripMeetingContextMode';
export type TripMeetingContextInput = {
    mode: TripMeetingContextMode;
    /**
     * Required when mode is existing.
     */
    meetingId?: string;
    /**
     * Optional when mode is new_saved. Defaults to the trip name.
     */
    meetingName?: string;
};
