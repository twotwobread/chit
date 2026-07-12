import { useMemo, useState, type ReactNode } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { Badge, PlacePin, PlaceTag, theme } from '../design';
import {
  DAY_ITINERARY_SWIPE_ACTION_WIDTH,
  resolveDayItinerarySwipeOffset,
  shouldOpenDayItinerarySwipeAction,
  shouldStartDayItineraryHorizontalSwipe,
} from '../trips/day-itinerary-swipe';
import {
  buildItinerarySegments,
  itineraryDurationLabel,
  itineraryTimeActionAccessibilityLabel,
  itineraryTimeActionLabel,
  type ItineraryTimelineItem,
  type ItineraryTimelineSegment,
} from './itinerary-segments';

export { buildItinerarySegments, type ItineraryTimelineItem, type ItineraryTimelineSegment };

export type ItineraryTimelineProps = {
  items: ItineraryTimelineItem[];
  emptyTitle?: string;
  emptyHelper?: string;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
};

export function ItineraryTimeline({
  emptyHelper = 'Day를 선택하거나 장소를 추가하면 일정이 여기에 보여요.',
  emptyTitle = '아직 등록된 일정이 없어요',
  getItemAccessibilityLabel,
  items,
  onItemNameRef,
  onPressItem,
  onPressTime,
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
      {buildItinerarySegments(items).map((segment) =>
        segment.kind === 'anchor' ? (
          <AnchorRow
            getItemAccessibilityLabel={getItemAccessibilityLabel}
            item={segment.item}
            key={segment.item.id}
            onItemNameRef={onItemNameRef}
            onPressItem={onPressItem}
            onPressTime={onPressTime}
            renderActions={renderActions}
            renderSwipeAction={renderSwipeAction}
          />
        ) : (
          <UntimedSegment
            getItemAccessibilityLabel={getItemAccessibilityLabel}
            items={segment.items}
            key={segment.id}
            onItemNameRef={onItemNameRef}
            onPressItem={onPressItem}
            onPressTime={onPressTime}
            renderActions={renderActions}
            renderSwipeAction={renderSwipeAction}
          />
        ),
      )}
    </View>
  );
}

function AnchorRow({
  getItemAccessibilityLabel,
  item,
  onItemNameRef,
  onPressItem,
  onPressTime,
  renderActions,
  renderSwipeAction,
}: {
  item: ItineraryTimelineItem;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
}) {
  const duration = itineraryDurationLabel(item.startTime ?? '', item.endTime);
  const done = item.status === 'done' || item.status === 'skipped';
  const timeLabel = item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime;

  return (
    <View style={styles.row}>
      <View style={styles.gutter}>
        <View style={[styles.spine, duration ? styles.spineStrong : null]} />
        <PlacePin faded={done} order={item.order} size={34} type={item.type} />
      </View>
      <View style={styles.body}>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{timeLabel}</Text>
          {duration ? <Badge label={duration} tone="success" /> : null}
          {item.note ? <Badge label={item.note} tone="amber" /> : null}
          {onPressTime ? <TimeButton item={item} onPressTime={onPressTime} /> : null}
        </View>
        <TimelineCard
          done={done}
          getItemAccessibilityLabel={getItemAccessibilityLabel}
          item={item}
          onItemNameRef={onItemNameRef}
          onPressItem={onPressItem}
          renderActions={renderActions}
          renderSwipeAction={renderSwipeAction}
        />
      </View>
    </View>
  );
}

function UntimedSegment({
  getItemAccessibilityLabel,
  items,
  onItemNameRef,
  onPressItem,
  onPressTime,
  renderActions,
  renderSwipeAction,
}: {
  items: ItineraryTimelineItem[];
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.gutter}>
        <View style={styles.spineDashed} />
      </View>
      <View style={styles.body}>
        <View style={styles.untimedBox}>
          <View style={styles.untimedHead}>
            <Clock color={theme.color.textMuted} size={14} strokeWidth={2} />
            <Text style={styles.untimedHeadText}>시간 미정 · 순서대로 방문</Text>
          </View>
          {items.map((item, index) => {
            const done = item.status === 'done' || item.status === 'skipped';
            return (
              <View key={item.id} style={index === 0 ? null : styles.untimedItemGap}>
                <TimelineCard
                  compact
                  done={done}
                  getItemAccessibilityLabel={getItemAccessibilityLabel}
                  item={item}
                  onItemNameRef={onItemNameRef}
                  onPressItem={onPressItem}
                  onPressTime={onPressTime}
                  renderActions={renderActions}
                  renderSwipeAction={renderSwipeAction}
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function TimelineCard({
  compact = false,
  done,
  getItemAccessibilityLabel,
  item,
  onItemNameRef,
  onPressItem,
  onPressTime,
  renderActions,
  renderSwipeAction,
}: {
  compact?: boolean;
  done: boolean;
  item: ItineraryTimelineItem;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
  getItemAccessibilityLabel?: (item: ItineraryTimelineItem) => string;
  onItemNameRef?: (item: ItineraryTimelineItem, node: Text | null) => void;
  renderActions?: (item: ItineraryTimelineItem) => ReactNode;
  renderSwipeAction?: (item: ItineraryTimelineItem) => ReactNode;
}) {
  const actions = renderActions?.(item);
  const swipeAction = renderSwipeAction?.(item);
  const accessibilityLabel = getItemAccessibilityLabel?.(item);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const hasSwipeAction = Boolean(swipeAction);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          hasSwipeAction && shouldStartDayItineraryHorizontalSwipe(gestureState),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          hasSwipeAction && shouldStartDayItineraryHorizontalSwipe(gestureState),
        onPanResponderMove: (_, gestureState) => {
          setSwipeOffset(resolveDayItinerarySwipeOffset(gestureState.dx));
        },
        onPanResponderRelease: (_, gestureState) => {
          setSwipeOffset(shouldOpenDayItinerarySwipeAction(gestureState) ? -DAY_ITINERARY_SWIPE_ACTION_WIDTH : 0);
        },
        onPanResponderTerminate: () => setSwipeOffset(0),
        onShouldBlockNativeResponder: () => false,
      }),
    [hasSwipeAction],
  );

  const content = (
    <>
      <PlacePin faded={done} order={item.order} size={compact ? 30 : 32} type={item.type} />
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
          {item.isLodging ? <Badge label="대표 숙소" tone="neutral" /> : null}
        </View>
        <View style={styles.metaRow}>
          <PlaceTag type={item.type} />
          {item.area ? <Text style={styles.meta}>{item.area}</Text> : null}
          {item.addedBy ? <Text style={styles.meta}>· {item.addedBy} 추가</Text> : null}
        </View>
        {item.legLabel ? <Text style={styles.leg}>{item.legLabel}</Text> : null}
        {actions ? <View style={styles.cardActions}>{actions}</View> : null}
      </View>
      {compact && onPressTime ? <TimeButton item={item} onPressTime={onPressTime} /> : null}
    </>
  );

  const card = onPressItem ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPressItem(item)}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.cardCompact : null,
        swipeOffset ? { transform: [{ translateX: swipeOffset }] } : null,
        pressed ? styles.pressed : null,
      ]}
      {...(hasSwipeAction ? panResponder.panHandlers : {})}
    >
      {content}
    </Pressable>
  ) : (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        swipeOffset ? { transform: [{ translateX: swipeOffset }] } : null,
      ]}
      {...(hasSwipeAction ? panResponder.panHandlers : {})}
    >
      {content}
    </View>
  );

  if (!swipeAction) {
    return card;
  }

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.swipeActionSlot}>{swipeAction}</View>
      {card}
    </View>
  );
}

function TimeButton({
  item,
  onPressTime,
}: {
  item: ItineraryTimelineItem;
  onPressTime: (item: ItineraryTimelineItem) => void;
}) {
  const label = itineraryTimeActionLabel(item);

  return (
    <Pressable
      accessibilityLabel={itineraryTimeActionAccessibilityLabel(item)}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => onPressTime(item)}
      style={({ pressed }) => [styles.timeButton, pressed ? styles.pressed : null]}
    >
      <Clock color={theme.color.primary} size={13} strokeWidth={2.2} />
      <Text style={styles.timeButtonText}>{label}</Text>
    </Pressable>
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
  },
  cardActions: {
    marginTop: theme.space[1],
  },
  cardCompact: {
    marginTop: 0,
    shadowOpacity: 0,
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
  swipeActionSlot: {
    alignItems: 'stretch',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: theme.space[2],
    width: DAY_ITINERARY_SWIPE_ACTION_WIDTH,
  },
  swipeWrap: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: theme.space[4],
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
  timeButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[1],
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  timeButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  untimedBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  untimedHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  untimedHeadText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  untimedItemGap: {
    marginTop: theme.space[2],
  },
  wrap: {
    width: '100%',
  },
});
