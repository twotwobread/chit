import { MeetingsService, type GetMeetingResponse, type ListMeetingsResponse } from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function listMeetings(): Promise<ListMeetingsResponse> {
  return runAuthenticatedRequest(() => MeetingsService.listMeetings());
}

export async function getMeeting(meetingId: string): Promise<GetMeetingResponse> {
  return runAuthenticatedRequest(() => MeetingsService.getMeeting(meetingId));
}
