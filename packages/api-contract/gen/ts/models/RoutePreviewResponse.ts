/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RoutePreviewMap } from './RoutePreviewMap';
import type { RoutePreviewMode } from './RoutePreviewMode';
import type { RoutePreviewSummary } from './RoutePreviewSummary';
export type RoutePreviewResponse = {
    scheduleItemId: string;
    mode: RoutePreviewMode;
    summary: RoutePreviewSummary;
    map: RoutePreviewMap | null;
    generatedAt: string;
};
