/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SettlementParticipantStatus } from './SettlementParticipantStatus';
export type SettlementParticipantSnapshot = {
    /**
     * Current participant id, or null for removed/unresolved historical rows.
     */
    participantId: string | null;
    displayName: string;
    participantStatus: SettlementParticipantStatus;
};
