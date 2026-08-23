import type {
  CreateEventRequest,
  EventCategory,
  EventMeetingChoice,
  GetEventResponse,
  MeetingMember,
} from '@i-um/api-contract';

export type OutingMeetingContextSelection =
  | { mode: 'one_off' }
  | { mode: 'existing'; meetingId: string }
  | { mode: 'new_saved'; meetingName: string };

export type OutingEventForm = {
  title: string;
  date: string;
  startTime?: string | null;
  category?: EventCategory | null;
  placeName?: string | null;
  placeAddress?: string | null;
  meetingContext: OutingMeetingContextSelection;
  participantMemberIds?: string[];
};

export type OutingCategoryOption = {
  value: EventCategory;
  label: string;
};

export type OutingDetailViewModel = {
  title: string;
  dateTimeLabel: string;
  categoryLabel: string;
  detailRows: [string, string][];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const categoryOptions: OutingCategoryOption[] = [
  { value: 'date', label: '데이트' },
  { value: 'friends', label: '친구' },
  { value: 'meal', label: '식사' },
  { value: 'cafe', label: '카페' },
  { value: 'activity', label: '활동' },
  { value: 'custom', label: '직접 입력' },
];

export function outingCategoryOptions(): OutingCategoryOption[] {
  return categoryOptions.map((option) => ({ ...option }));
}

export function outingCategoryLabel(category: EventCategory | null | undefined): string {
  return categoryOptions.find((option) => option.value === category)?.label ?? '약속';
}

export function buildCreateOutingEventRequest(form: OutingEventForm): CreateEventRequest {
  const title = form.title.trim();
  const date = form.date.trim();
  const request: CreateEventRequest = {
    title,
    startDate: date,
    endDate: date,
    eventType: 'outing',
    defaultCurrency: 'KRW',
    meeting: buildEventMeetingChoice(form.meetingContext, title),
  };

  const startTime = form.startTime?.trim();
  if (startTime) {
    request.startTime = startTime;
  }
  request.category = form.category ?? 'custom';

  const placeName = form.placeName?.trim();
  if (placeName) {
    request.placeName = placeName;
  }
  const placeAddress = form.placeAddress?.trim();
  if (placeAddress) {
    request.placeAddress = placeAddress;
  }
  if (form.meetingContext.mode === 'existing' && form.participantMemberIds) {
    request.participantMemberIds = [...form.participantMemberIds];
  }
  return request;
}

export function validateOutingEventForm(
  form: OutingEventForm,
  members: readonly MeetingMember[],
  currentUserId: string | null | undefined,
): string | null {
  if (form.title.trim().length === 0) {
    return '약속 이름을 입력해주세요.';
  }
  if (!isValidDateString(form.date)) {
    return '날짜를 YYYY-MM-DD 형식으로 입력해주세요.';
  }
  const startTime = form.startTime?.trim();
  if (startTime && !timePattern.test(startTime)) {
    return '시간을 HH:mm 형식으로 입력해주세요.';
  }
  if (form.category && !categoryOptions.some((option) => option.value === form.category)) {
    return '약속 종류를 다시 선택해주세요.';
  }
  if (form.meetingContext.mode === 'existing') {
    if (!form.meetingContext.meetingId.trim()) {
      return '함께할 모임을 선택해주세요.';
    }
    const selectedIds = form.participantMemberIds ?? members.map((member) => member.id);
    if (selectedIds.length === 0) {
      return '이번 약속 참여자를 1명 이상 선택해주세요.';
    }
    const memberIds = new Set(members.map((member) => member.id));
    if (selectedIds.some((memberId) => !memberIds.has(memberId))) {
      return '참여자 선택을 다시 확인해주세요.';
    }
    const currentUserMember = members.find((member) => member.userId === currentUserId);
    if (currentUserMember && !selectedIds.includes(currentUserMember.id)) {
      return '내가 참여자로 포함되어야 약속을 만들 수 있어요.';
    }
  }
  if (form.meetingContext.mode === 'new_saved' && [...form.meetingContext.meetingName.trim()].length > 80) {
    return '모임 이름은 80자 이내로 입력해주세요.';
  }
  return null;
}

export function buildOutingDetailViewModel(response: GetEventResponse): OutingDetailViewModel {
  const event = response.event;
  const participants = response.participants
    .map((participant) => participant.displayName)
    .filter(Boolean)
    .join(', ');
  const detailRows: [string, string][] = [['모임', response.meeting.name]];
  const placeLabel = buildPlaceLabel(event.placeName, event.placeAddress);
  if (placeLabel) {
    detailRows.push(['장소', placeLabel]);
  }
  if (participants) {
    detailRows.push(['참여자', participants]);
  }
  return {
    title: event.title,
    dateTimeLabel: formatOutingDateTime(event.startDate, event.startTime),
    categoryLabel: outingCategoryLabel(event.category),
    detailRows,
  };
}

export function formatOutingDateTime(date: string, startTime?: string | null): string {
  const label = date.replace(/-/g, '.');
  return startTime ? `${label} ${startTime}` : label;
}

function buildEventMeetingChoice(context: OutingMeetingContextSelection, fallbackTitle: string): EventMeetingChoice {
  if (context.mode === 'existing') {
    return { mode: 'existing', meetingId: context.meetingId };
  }
  if (context.mode === 'new_saved') {
    return { mode: 'new', name: context.meetingName.trim() || fallbackTitle };
  }
  return { mode: 'one_off' };
}

function isValidDateString(value: string): boolean {
  const trimmed = value.trim();
  if (!datePattern.test(trimmed)) {
    return false;
  }
  const date = new Date(`${trimmed}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === trimmed;
}

function buildPlaceLabel(placeName?: string | null, placeAddress?: string | null): string {
  const parts = [placeName, placeAddress].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return parts.join(' · ');
}
