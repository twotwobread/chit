/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Event } from './Event';
import type { EventParticipant } from './EventParticipant';
import type { Meeting } from './Meeting';
export type CreateEventResponse = {
    event: Event;
    meeting: Meeting;
    ownerParticipant: EventParticipant;
};
