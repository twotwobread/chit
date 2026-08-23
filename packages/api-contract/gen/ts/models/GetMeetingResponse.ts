/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Event } from './Event';
import type { Meeting } from './Meeting';
import type { MeetingMember } from './MeetingMember';
export type GetMeetingResponse = {
    meeting: Meeting;
    members: Array<MeetingMember>;
    events: Array<Event>;
};
