import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { Badge, PlaceTag, theme } from '../design';
import { SwipeActionRow } from './SwipeActionRow';
import {
  buildItinerarySegments,
  itineraryDurationLabel,
  itineraryTimeLabel,
  type ItineraryTimelineItem,
  type ItineraryTimelineSegment,
} from './itinerary-segments';

export { buildItinerarySegments, type ItineraryTimelineItem, type ItineraryTimelineSegment };

export type ItineraryTimelineProps = {
  items: ItineraryTimelineItem[];
  emptyTitle?: string;
  emptyHelper?: string;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressLodgingBadge?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
};

export function ItineraryTimeline({
  emptyHelper = '일차를 선택하거나 장소를 추가하면 일정이 여기에 보여요.',
  emptyTitle = '아직 등록된 일정이 없어요',
  getItemAccessibilityLabel,
  items,
  onItemNameRef,
  onPressItem,
  onPressLodgingBadge,
  renderActions,
  renderSwipeAction,
}: ItineraryTimelineProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Clock color={theme.color.textFaint} size={20} strokeWidth={2} />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyHelper}>{emptyHelper}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {buildItinerarySegments(items).map((segment) => (
        <TimelineRow
          getItemAccessibilityLabel={getItemAccessibilityLabel}
          item={segment.item}
          key={segment.id}
          markerTone={segment.kind === 'anchor' ? 'timed' : 'untimed'}
          onItemNameRef={onItemNameRef}
          onPressItem={onPressItem}
          onPressLodgingBadge={onPressLodgingBadge}
          renderActions={renderActions}
          renderSwipeAction={renderSwipeAction}
        />
      ))}
    </View>
  );
}

type TimelineMarkerTone = 'timed' | 'untimed';

function TimelineRow({
  getItemAccessibilityLabel,
  item,
  markerTone,
  onItemNameRef,
  onPressItem,
  onPressLodgingBadge,
  renderActions,
  renderSwipeAction,
}: {
  item: ItineraryTimelineItem;
  markerTone: TimelineMarkerTone;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressLodgingBadge?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
}) {
  const duration = markerTone === 'timed' ? itineraryDurationLabel(item.startTime ?? '', item.endTime) : null;
  const done = item.status === 'done' || item.status === 'skipped';
  const markerLabel = markerTone === 'timed' ? String(item.order) : '?';
  const timeLabel = itineraryTimeLabel(item.startTime, item.endTime);

  return (
    <View style={styles.row}>
      <View style={styles.gutter}>
        <View
          style={markerTone === 'timed' ? [styles.spine, duration ? styles.spineStrong : null] : styles.spineDashed}
        />
        <TimelineMarker faded={done} label={markerLabel} size={34} tone={markerTone} />
      </View>
      <View style={styles.body}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{timeLabel}</Text>
          {duration ? <Badge label={duration} tone="success" /> : null}
          {item.note ? <Badge label={item.note} tone="amber" /> : null}
        </View>
        <TimelineCard
          done={done}
          getItemAccessibilityLabel={getItemAccessibilityLabel}
          item={item}
          onItemNameRef={onItemNameRef}
          onPressItem={onPressItem}
          onPressLodgingBadge={onPressLodgingBadge}
          renderActions={renderActions}
          renderSwipeAction={renderSwipeAction}
        />
      </View>
    </View>
  );
}

function TimelineMarker({
  faded = false,
  label,
  size,
  tone,
}: {
  faded?: boolean;
  label: string;
  size: number;
  tone: TimelineMarkerTone;
}) {
  return (
    <View
      style={[
        styles.timelineMarker,
        {
          borderRadius: size / 2,
          height: size,
          opacity: faded ? 0.5 : 1,
          width: size,
        },
        tone === 'timed' ? styles.timelineMarkerTimed : styles.timelineMarkerUntimed,
      ]}
    >
      <Text
        style={[
          styles.timelineMarkerText,
          { fontSize: size * 0.46 },
          tone === 'timed' ? styles.timelineMarkerTextTimed : styles.timelineMarkerTextUntimed,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function TimelineCard({
  done,
  getItemAccessibilityLabel,
  item,
  onItemNameRef,
  onPressItem,
  onPressLodgingBadge,
  renderActions,
  renderSwipeAction,
}: {
  done: boolean;
  item: ItineraryTimelineItem;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressLodgingBadge?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
}) {
  const actions = renderActions?.(item);
  const swipeAction = renderSwipeAction?.(item);
  const accessibilityLabel = getItemAccessibilityLabel?.(item);

  const content = (
    <View style={styles.cardBody}>
      <View style={styles.nameRow}>
        <Text
          accessibilityLabel={accessibilityLabel}
          ref={(node) => onItemNameRef?.(item, node)}
          style={[styles.name, done ? styles.nameDone : null]}
        >
          {item.name}
        </Text>
        {item.status === 'next' ? <Badge label="다음" solid tone="primary" /> : null}
        {item.status === 'done' ? <Badge label="완료" tone="neutral" /> : null}
        {item.status === 'skipped' ? <Badge label="건너뜀" tone="neutral" /> : null}
        {item.lodgingBadgeLabel ? (
          onPressLodgingBadge ? (
            <Pressable
              accessibilityLabel={`${item.name} 대표 숙소 관리`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onPressLodgingBadge(item)}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Badge label={item.lodgingBadgeLabel} tone="primary" />
            </Pressable>
          ) : (
            <Badge label={item.lodgingBadgeLabel} tone="primary" />
          )
        ) : null}
      </View>
      <View style={styles.metaRow}>
        <PlaceTag type={item.type} />
        {item.area ? <Text style={styles.meta}>{item.area}</Text> : null}
        {item.addedBy ? <Text style={styles.meta}>· {item.addedBy} 추가</Text> : null}
      </View>
      {item.legLabel ? <Text style={styles.leg}>{item.legLabel}</Text> : null}
      {actions ? <View style={styles.cardActions}>{actions}</View> : null}
    </View>
  );

  const card = onPressItem ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPressItem(item)}
      style={({ pressed }) => [styles.card, swipeAction ? styles.cardSwipeable : null, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.card, swipeAction ? styles.cardSwipeable : null]}>{content}</View>
  );

  if (!swipeAction) {
    return card;
  }

  return (
    <SwipeActionRow renderRightAction={() => swipeAction} style={styles.swipeRowSpacing}>
      {card}
    </SwipeActionRow>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingBottom: theme.space[5],
  },
  card: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[2],
    padding: theme.space[4],
    ...theme.shadow.xs,
  },
  cardBody: {
    flex: 1,
    gap: theme.space[2],
    minWidth: 0,
  },
  cardActions: {
    marginTop: theme.space[1],
  },
  cardSwipeable: {
    marginTop: 0,
  },
  timelineMarker: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderWidth: 2,
    justifyContent: 'center',
  },
  timelineMarkerText: {
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  timelineMarkerTextTimed: {
    color: theme.color.green[600],
  },
  timelineMarkerTextUntimed: {
    color: theme.color.textMuted,
  },
  timelineMarkerTimed: {
    borderColor: theme.color.green[600],
    borderStyle: 'solid',
  },
  timelineMarkerUntimed: {
    borderColor: theme.color.borderStrong,
    borderStyle: 'dashed',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[6],
  },
  emptyHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    textAlign: 'center',
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  gutter: {
    alignItems: 'center',
    width: 38,
  },
  leg: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  meta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  name: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  nameDone: {
    color: theme.color.textMuted,
    textDecorationLine: 'line-through',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  swipeRowSpacing: {
    marginTop: theme.space[2],
  },
  spine: {
    backgroundColor: theme.color.borderDefault,
    borderRadius: 2,
    bottom: -theme.space[4],
    position: 'absolute',
    top: theme.space[2],
    width: 2,
  },
  spineDashed: {
    borderColor: theme.color.borderDefault,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    bottom: -theme.space[4],
    position: 'absolute',
    top: theme.space[2],
  },
  spineStrong: {
    backgroundColor: theme.color.green[300],
    width: 3,
  },
  time: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  wrap: {
    width: '100%',
  },
});
