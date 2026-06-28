import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';

import { Badge, PlacePin, PlaceTag, theme } from '../design';
import {
  buildItinerarySegments,
  itineraryDurationLabel,
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
};

export function ItineraryTimeline({
  emptyHelper = 'Day를 선택하거나 장소를 추가하면 일정이 여기에 보여요.',
  emptyTitle = '아직 등록된 일정이 없어요',
  items,
  onPressItem,
  onPressTime,
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
          <AnchorRow item={segment.item} key={segment.item.id} onPressItem={onPressItem} onPressTime={onPressTime} />
        ) : (
          <UntimedSegment items={segment.items} key={segment.id} onPressItem={onPressItem} onPressTime={onPressTime} />
        ),
      )}
    </View>
  );
}

function AnchorRow({
  item,
  onPressItem,
  onPressTime,
}: {
  item: ItineraryTimelineItem;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
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
        <TimelineCard done={done} item={item} onPressItem={onPressItem} />
      </View>
    </View>
  );
}

function UntimedSegment({
  items,
  onPressItem,
  onPressTime,
}: {
  items: ItineraryTimelineItem[];
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
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
                <TimelineCard compact done={done} item={item} onPressItem={onPressItem} onPressTime={onPressTime} />
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
  item,
  onPressItem,
  onPressTime,
}: {
  compact?: boolean;
  done: boolean;
  item: ItineraryTimelineItem;
  onPressItem?: (item: ItineraryTimelineItem) => void;
  onPressTime?: (item: ItineraryTimelineItem) => void;
}) {
  const content = (
    <>
      <PlacePin faded={done} order={item.order} size={compact ? 30 : 32} type={item.type} />
      <View style={styles.cardBody}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, done ? styles.nameDone : null]}>{item.name}</Text>
          {item.status === 'next' ? <Badge label="다음" solid tone="primary" /> : null}
          {item.isLodging ? <Badge label="숙소" tone="neutral" /> : null}
        </View>
        <View style={styles.metaRow}>
          <PlaceTag type={item.type} />
          {item.area ? <Text style={styles.meta}>{item.area}</Text> : null}
          {item.addedBy ? <Text style={styles.meta}>· {item.addedBy} 추가</Text> : null}
        </View>
        {item.legLabel ? <Text style={styles.leg}>{item.legLabel}</Text> : null}
      </View>
      {compact && onPressTime ? <TimeButton item={item} onPressTime={onPressTime} /> : null}
    </>
  );

  if (onPressItem) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onPressItem(item)}
        style={({ pressed }) => [styles.card, compact ? styles.cardCompact : null, pressed ? styles.pressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, compact ? styles.cardCompact : null]}>{content}</View>;
}

function TimeButton({
  item,
  onPressTime,
}: {
  item: ItineraryTimelineItem;
  onPressTime: (item: ItineraryTimelineItem) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${item.name} 시간 편집`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => onPressTime(item)}
      style={({ pressed }) => [styles.timeButton, pressed ? styles.pressed : null]}
    >
      <Clock color={theme.color.primary} size={13} strokeWidth={2.2} />
      <Text style={styles.timeButtonText}>시간</Text>
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
