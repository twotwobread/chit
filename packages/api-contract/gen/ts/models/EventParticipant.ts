/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeetingMemberRole } from './MeetingMemberRole';
export type EventParticipant = {
    id: string;
    eventId: string;
    meetingMemberId: string | null;
    userId: string;
    role: MeetingMemberRole;
    displayName: string;
    joinedAt: string;
};
