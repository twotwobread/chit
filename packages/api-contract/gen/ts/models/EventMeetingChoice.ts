/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EventMeetingMode } from './EventMeetingMode';
export type EventMeetingChoice = {
    mode: EventMeetingMode;
    /**
     * Required when mode is existing.
     */
    meetingId?: string;
    /**
     * Required when mode is new; optional one-off container label when mode is one_off.
     */
    name?: string;
};
