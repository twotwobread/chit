/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoutePreviewMap } from './RoutePreviewMap';
import type { RoutePreviewSummary } from './RoutePreviewSummary';
export type RoutePreviewResponse = {
    itemId: string;
    mode: 'transit';
    summary: RoutePreviewSummary;
    map: RoutePreviewMap | null;
    generatedAt: string;
};

