import { MeetingsService, type ListMeetingsResponse } from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function listMeetings(): Promise<ListMeetingsResponse> {
  return runAuthenticatedRequest(() => MeetingsService.listMeetings());
}
