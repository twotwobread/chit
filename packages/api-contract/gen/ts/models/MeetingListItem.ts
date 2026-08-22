/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MeetingMemberRole } from './MeetingMemberRole';
import type { MeetingVisibility } from './MeetingVisibility';
export type MeetingListItem = {
    id: string;
    name: string;
    visibility: MeetingVisibility;
    memberCount: number;
    myRole: MeetingMemberRole;
    createdAt: string;
    updatedAt: string;
};
