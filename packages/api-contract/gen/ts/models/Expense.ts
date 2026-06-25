/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpensePlaceSnapshot } from './ExpensePlaceSnapshot';
import type { ExpenseSplit } from './ExpenseSplit';
import type { SupportedCurrency } from './SupportedCurrency';
export type Expense = {
    id: string;
    tripId: string;
    scheduledDate: string;
    /**
     * Source itinerary item. Present at creation; may become null later if the source item is deleted and history is retained.
     */
    itineraryItemId: string | null;
    /**
     * Source trip place. Present at creation; may become null later if the source place is deleted and history is retained.
     */
    tripPlaceId: string | null;
    place: ExpensePlaceSnapshot;
    amountMinor: number;
    currency: SupportedCurrency;
    payerParticipantId: string | null;
    payerDisplayName: string;
    splits: Array<ExpenseSplit>;
    createdAt: string;
};

