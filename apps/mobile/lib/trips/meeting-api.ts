import {
  EventsService,
  MeetingsService,
  type CreateEventExpenseRequest,
  type CreateEventExpenseResponse,
  type CreateEventRequest,
  type CreateEventResponse,
  type CreateMeetingInviteResponse,
  type GetEventResponse,
  type GetEventSettlementResponse,
  type GetMeetingResponse,
  type ListEventExpensesResponse,
  type ListMeetingsResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function listMeetings(): Promise<ListMeetingsResponse> {
  return runAuthenticatedRequest(() => MeetingsService.listMeetings());
}

export async function getMeeting(meetingId: string): Promise<GetMeetingResponse> {
  return runAuthenticatedRequest(() => MeetingsService.getMeeting(meetingId));
}

export async function createMeetingInvite(meetingId: string): Promise<CreateMeetingInviteResponse> {
  return runAuthenticatedRequest(() => MeetingsService.createMeetingInvite(meetingId));
}

export async function removeMeetingMember(meetingId: string, memberId: string): Promise<void> {
  return runAuthenticatedRequest(() => MeetingsService.removeMeetingMember(meetingId, memberId));
}

export async function leaveMeeting(meetingId: string): Promise<void> {
  return runAuthenticatedRequest(() => MeetingsService.leaveMeeting(meetingId));
}

export async function createEvent(request: CreateEventRequest): Promise<CreateEventResponse> {
  return runAuthenticatedRequest(() => EventsService.createEvent(request));
}

export async function getEvent(eventId: string): Promise<GetEventResponse> {
  return runAuthenticatedRequest(() => EventsService.getEvent(eventId));
}

export async function listEventExpenses(eventId: string): Promise<ListEventExpensesResponse> {
  return runAuthenticatedRequest(() => EventsService.listEventExpenses(eventId));
}

export async function createEventExpense(
  eventId: string,
  request: CreateEventExpenseRequest,
): Promise<CreateEventExpenseResponse> {
  return runAuthenticatedRequest(() => EventsService.createEventExpense(eventId, request));
}

export async function getEventSettlement(eventId: string): Promise<GetEventSettlementResponse> {
  return runAuthenticatedRequest(() => EventsService.getEventSettlement(eventId));
}
