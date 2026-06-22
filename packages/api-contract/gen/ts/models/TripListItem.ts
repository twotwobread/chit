/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripParticipantRole } from './TripParticipantRole';
export type TripListItem = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    joinedAt: string;
    createdAt: string;
    myRole: TripParticipantRole;
    participantCount: number;
};

