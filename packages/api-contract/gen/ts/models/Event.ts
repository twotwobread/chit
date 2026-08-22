/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EventStatus } from './EventStatus';
import type { EventType } from './EventType';
import type { MeetingVisibility } from './MeetingVisibility';
import type { SupportedCurrency } from './SupportedCurrency';
export type Event = {
    id: string;
    meetingId: string;
    meetingName: string;
    meetingVisibility: MeetingVisibility;
    eventType: EventType;
    title: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    status: EventStatus;
    tripId: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
};
