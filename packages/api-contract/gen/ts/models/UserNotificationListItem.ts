/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationEventType } from './NotificationEventType';
import type { NotificationSnapshot } from './NotificationSnapshot';
export type UserNotificationListItem = {
    id: string;
    eventType: NotificationEventType;
    title: string;
    body: string;
    actionPath: string;
    snapshot: NotificationSnapshot;
    createdAt: string;
    readAt: string | null;
};
