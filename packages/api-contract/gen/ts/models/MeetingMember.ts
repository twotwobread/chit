/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeetingMemberRole } from './MeetingMemberRole';
export type MeetingMember = {
    id: string;
    meetingId: string;
    userId: string;
    role: MeetingMemberRole;
    displayName: string;
    joinedAt: string;
};
