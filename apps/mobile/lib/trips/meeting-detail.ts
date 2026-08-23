import type { Href } from 'expo-router';

import type {
  Event,
  GetMeetingResponse,
  GetMySettlementSummaryResponse,
  MeetingMember,
  MeetingMemberRole,
} from '@i-um/api-contract';

import { formatTripDateRange } from './mypage';
import { formatMoney } from './quick-expense';
import { tripSettlePath, tripTodayPath } from './routes';

export type MeetingDetailEventViewModel = {
  id: string;
  title: string;
  eventTypeLabel: string;
  dateRangeLabel: string;
  statusLabel: string;
  route: Href | null;
};

export type MeetingDetailMemberViewModel = {
  id: string;
  displayName: string;
  roleLabel: string;
  joinedAt: string;
};

export type MeetingDetailSettlementTaskViewModel = {
  tripId: string;
  tripName: string;
  dateRangeLabel: string;
  route: Href;
  summaryLabels: string[];
};

export type MeetingDetailViewModel = {
  id: string;
  title: string;
  subtitle: string;
  memberPreviewLabel: string;
  upcomingEvents: MeetingDetailEventViewModel[];
  pastEvents: MeetingDetailEventViewModel[];
  settlementTasks: MeetingDetailSettlementTaskViewModel[];
  members: MeetingDetailMemberViewModel[];
  isEmpty: boolean;
};

export type BuildMeetingDetailViewModelInput = {
  detail: GetMeetingResponse;
  settlementSummary: GetMySettlementSummaryResponse;
  today: string;
};

export function buildMeetingDetailViewModel({
  detail,
  settlementSummary,
  today,
}: BuildMeetingDetailViewModelInput): MeetingDetailViewModel {
  const members = [...detail.members].sort(compareMeetingMembers).map(toMemberViewModel);
  const upcomingEvents = detail.events
    .filter((event) => event.endDate >= today)
    .sort(compareUpcomingEvents)
    .map(toEventViewModel);
  const pastEvents = detail.events
    .filter((event) => event.endDate < today)
    .sort(comparePastEvents)
    .map(toEventViewModel);
  const meetingTripIDs = new Set(detail.events.flatMap((event) => (event.tripId ? [event.tripId] : [])));
  const settlementTasks = settlementSummary.trips
    .filter((trip) => meetingTripIDs.has(trip.tripId))
    .map((trip) => ({
      tripId: trip.tripId,
      tripName: trip.tripName,
      dateRangeLabel: formatTripDateRange(trip.startDate, trip.endDate),
      route: tripSettlePath(trip.tripId),
      summaryLabels: trip.currencySummaries.map(
        (summary) =>
          `${settlementDirectionLabel(summary.direction)} ${formatMoney(summary.netMinor, summary.currency)}`,
      ),
    }));

  return {
    id: detail.meeting.id,
    title: detail.meeting.name,
    subtitle: `${members.length}명이 함께하는 모임`,
    memberPreviewLabel: members
      .map((member) => member.displayName)
      .slice(0, 3)
      .join(', '),
    upcomingEvents,
    pastEvents,
    settlementTasks,
    members,
    isEmpty: upcomingEvents.length === 0 && pastEvents.length === 0 && settlementTasks.length === 0,
  };
}

export function meetingMemberRoleLabel(role: MeetingMemberRole): string {
  switch (role) {
    case 'owner':
      return '모임장';
    case 'member':
      return '멤버';
    default: {
      const exhaustive: never = role;
      throw new Error(`Unsupported meeting member role: ${exhaustive}`);
    }
  }
}

function toMemberViewModel(member: MeetingMember): MeetingDetailMemberViewModel {
  return {
    id: member.id,
    displayName: member.displayName,
    roleLabel: meetingMemberRoleLabel(member.role),
    joinedAt: member.joinedAt,
  };
}

function toEventViewModel(event: Event): MeetingDetailEventViewModel {
  return {
    id: event.id,
    title: event.title,
    eventTypeLabel: eventTypeLabel(event.eventType),
    dateRangeLabel: formatTripDateRange(event.startDate, event.endDate),
    statusLabel: eventStatusLabel(event.status),
    route: event.tripId ? tripTodayPath(event.tripId) : null,
  };
}

function compareMeetingMembers(left: MeetingMember, right: MeetingMember): number {
  const roleCompare = roleOrder(left.role) - roleOrder(right.role);
  if (roleCompare !== 0) {
    return roleCompare;
  }
  return left.joinedAt.localeCompare(right.joinedAt) || left.id.localeCompare(right.id);
}

function roleOrder(role: MeetingMemberRole): number {
  return role === 'owner' ? 0 : 1;
}

function compareUpcomingEvents(left: Event, right: Event): number {
  return (
    left.startDate.localeCompare(right.startDate) ||
    left.endDate.localeCompare(right.endDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

function comparePastEvents(left: Event, right: Event): number {
  return (
    right.endDate.localeCompare(left.endDate) ||
    right.startDate.localeCompare(left.startDate) ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id)
  );
}

function eventTypeLabel(eventType: Event['eventType']): string {
  switch (eventType) {
    case 'trip':
      return '여행 일정';
    case 'outing':
      return '약속';
    default: {
      const exhaustive: never = eventType;
      throw new Error(`Unsupported meeting event type: ${exhaustive}`);
    }
  }
}

function eventStatusLabel(status: Event['status']): string {
  switch (status) {
    case 'planned':
      return '예정';
    case 'completed':
      return '완료';
    case 'cancelled':
      return '취소';
    default: {
      const exhaustive: never = status;
      throw new Error(`Unsupported meeting event status: ${exhaustive}`);
    }
  }
}

function settlementDirectionLabel(direction: 'send' | 'receive'): string {
  switch (direction) {
    case 'send':
      return '보낼 돈';
    case 'receive':
      return '받을 돈';
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unsupported meeting settlement direction: ${exhaustive}`);
    }
  }
}
