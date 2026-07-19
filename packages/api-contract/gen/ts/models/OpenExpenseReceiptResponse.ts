/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ReceiptImageContentType } from './ReceiptImageContentType';
export type OpenExpenseReceiptResponse = {
    /**
     * Short-lived signed URL. Clients must not persist it.
     */
    url: string;
    expiresAt: string;
    contentType: ReceiptImageContentType;
    byteSize: number;
};
