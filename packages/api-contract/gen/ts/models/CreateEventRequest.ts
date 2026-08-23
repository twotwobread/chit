/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EventCategory } from './EventCategory';
import type { EventMeetingChoice } from './EventMeetingChoice';
import type { EventType } from './EventType';
import type { SupportedCurrency } from './SupportedCurrency';
export type CreateEventRequest = {
    /**
     * Server trims leading/trailing whitespace.
     */
    title: string;
    startDate: string;
    endDate: string;
    eventType: EventType;
    defaultCurrency: SupportedCurrency;
    /**
     * Optional local start time in HH:mm for lightweight outing events.
     */
    startTime?: string | null;
    /**
     * Optional outing place display name. Server trims leading/trailing whitespace.
     */
    placeName?: string | null;
    /**
     * Optional outing place address. Server trims leading/trailing whitespace.
     */
    placeAddress?: string | null;
    /**
     * Optional outing category preset. Defaults to custom for new outing creation.
     */
    category?: EventCategory | null;
    meeting: EventMeetingChoice;
    /**
     * Optional current saved meeting member IDs that should participate when meeting.mode is existing. Omitted means all current saved meeting members.
     */
    participantMemberIds?: Array<string> | null;
};
