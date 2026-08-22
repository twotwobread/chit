/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
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
    meeting: EventMeetingChoice;
};
