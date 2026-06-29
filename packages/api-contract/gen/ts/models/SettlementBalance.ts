/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SettlementParticipantSnapshot } from './SettlementParticipantSnapshot';
export type SettlementBalance = {
    participant: SettlementParticipantSnapshot;
    paidMinor: number;
    shareMinor: number;
    /**
     * Positive means the participant should receive; negative means they should pay.
     */
    netMinor: number;
};

