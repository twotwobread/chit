/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ExpenseReceiptExtraction } from './ExpenseReceiptExtraction';
import type { ReceiptCaptureMode } from './ReceiptCaptureMode';
import type { ReceiptImageContentType } from './ReceiptImageContentType';
export type ExpenseReceiptDraft = {
    id: string;
    tripId: string;
    captureMode: ReceiptCaptureMode;
    imageCount: number;
    /**
     * Content type of the first stored capture image.
     */
    contentType: ReceiptImageContentType;
    byteSize: number;
    extraction: ExpenseReceiptExtraction;
    expiresAt: string;
    createdAt: string;
};
