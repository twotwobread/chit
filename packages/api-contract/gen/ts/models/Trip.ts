/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SupportedCurrency } from './SupportedCurrency';
import type { TripDestination } from './TripDestination';
export type Trip = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    defaultCurrency: SupportedCurrency;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    destinations: Array<TripDestination>;
};
