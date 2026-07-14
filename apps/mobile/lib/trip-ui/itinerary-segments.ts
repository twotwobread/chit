import { theme } from '../design/theme';

export type ItineraryTimelineItem = {
  id: string;
  order: number;
  type: keyof typeof theme.placeType;
  name: string;
  area?: string;
  startTime?: string | null;
  endTime?: string | null;
  note?: string;
  addedBy?: string;
  status?: 'done' | 'next' | 'todo' | 'skipped';
  legLabel?: string;
  isLodging?: boolean;
  lodgingBadgeLabel?: string | null;
};

export type ItineraryTimelineSegment =
  | { kind: 'anchor'; id: string; item: ItineraryTimelineItem }
  | { kind: 'untimed'; id: string; item: ItineraryTimelineItem };

export function buildItinerarySegments(items: ItineraryTimelineItem[]): ItineraryTimelineSegment[] {
  return items.map(
    (item): ItineraryTimelineSegment => ({
      kind: item.startTime ? 'anchor' : 'untimed',
      id: item.id,
      item,
    }),
  );
}

export function itineraryTimeLabel(startTime?: string | null, endTime?: string | null): string {
  if (!startTime) {
    return '시간 미정';
  }

  return endTime ? `${startTime} – ${endTime}` : `${startTime} – 종료 미정`;
}

export function itineraryDurationLabel(startTime: string, endTime?: string | null): string | null {
  if (!endTime) {
    return null;
  }

  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null || end <= start) {
    return null;
  }

  const minutes = end - start;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}시간 ${remainder}분` : `${hours}시간`;
  }

  return `${minutes}분`;
}

function parseTimeToMinutes(value: string): number | null {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}
