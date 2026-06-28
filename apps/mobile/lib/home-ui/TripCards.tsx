import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight, MapPin } from 'lucide-react-native';

import { AvatarGroup, Badge, theme } from '../design';

export type ActiveTripCardProps = {
  name: string;
  dayLabel: string;
  nextPlaceLabel?: string;
  nextTimeLabel?: string;
  completedCount: number;
  totalCount: number;
  members?: { name: string; color?: string }[];
  onPress: () => void;
};

export type UpcomingTripRowProps = {
  name: string;
  dateLabel: string;
  companionsLabel?: string;
  ddayLabel?: string;
  statusLabel?: string;
  statusTone?: 'amber' | 'neutral' | 'success';
  onPress: () => void;
};

export type PastTripRowProps = {
  name: string;
  dateLabel: string;
  settledLabel?: string;
  onPress: () => void;
  first?: boolean;
};

export function ActiveTripCard({
  completedCount,
  dayLabel,
  members = [],
  name,
  nextPlaceLabel,
  nextTimeLabel,
  onPress,
  totalCount,
}: ActiveTripCardProps) {
  const progress = totalCount > 0 ? Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100))) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed ? styles.pressed : null]}
    >
      <View style={styles.heroHead}>
        <View style={styles.heroDayBadge}>
          <Text style={styles.heroDayText}>{dayLabel}</Text>
        </View>
        {members.length > 0 ? <AvatarGroup members={members} size={28} /> : null}
      </View>

      <Text numberOfLines={1} style={styles.heroName}>
        {name}
      </Text>
      {nextPlaceLabel ? (
        <View style={styles.heroNextRow}>
          <MapPin color={theme.color.green[300]} size={16} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.heroNext}>
            다음 <Text style={styles.heroNextStrong}>{nextPlaceLabel}</Text>
            {nextTimeLabel ? ` · ${nextTimeLabel}` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.heroNext}>오늘 남은 장소를 확인해보세요.</Text>
      )}

      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {totalCount}곳 중 {completedCount}곳
        </Text>
      </View>

      <View style={styles.heroCta}>
        <Text style={styles.heroCtaText}>오늘 일정 들어가기</Text>
        <ChevronRight color={theme.color.green[800]} size={18} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

export function UpcomingTripRow({
  companionsLabel,
  dateLabel,
  ddayLabel,
  name,
  onPress,
  statusLabel,
  statusTone = 'amber',
}: UpcomingTripRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.upcoming, pressed ? styles.pressed : null]}
    >
      {ddayLabel ? (
        <View style={styles.ddayBadge}>
          <Text style={styles.ddayCaption}>D-DAY</Text>
          <Text style={styles.ddayText}>{ddayLabel}</Text>
        </View>
      ) : null}
      <View style={styles.upcomingBody}>
        <Text numberOfLines={1} style={styles.upcomingName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.upcomingMeta}>
          {[dateLabel, companionsLabel].filter(Boolean).join(' · ')}
        </Text>
        {statusLabel ? <Badge label={statusLabel} tone={statusTone === 'success' ? 'success' : statusTone} /> : null}
      </View>
      <ChevronRight color={theme.color.textFaint} size={20} strokeWidth={2} />
    </Pressable>
  );
}

export function PastTripRow({ first = false, name, dateLabel, onPress, settledLabel = '정산 완료' }: PastTripRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.past, first ? null : styles.pastDivider, pressed ? styles.pressed : null]}
    >
      <View style={styles.pastIcon}>
        <MapPin color={theme.color.textMuted} size={19} strokeWidth={2} />
      </View>
      <View style={styles.pastBody}>
        <Text numberOfLines={1} style={styles.pastName}>
          {name}
        </Text>
        <Text style={styles.pastMeta}>{dateLabel}</Text>
      </View>
      <View style={styles.settledTag}>
        <Check color={theme.color.green[700]} size={13} strokeWidth={2.6} />
        <Text style={styles.settledText}>{settledLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ddayBadge: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.md,
    height: 52,
    justifyContent: 'center',
    width: 54,
  },
  ddayCaption: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 0.4,
  },
  ddayText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
  fill: {
    backgroundColor: theme.color.green[400],
    borderRadius: theme.radius.pill,
    height: '100%',
  },
  hero: {
    backgroundColor: theme.color.green[900],
    borderRadius: theme.radius['2xl'],
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.lg,
  },
  heroCta: {
    alignItems: 'center',
    backgroundColor: theme.color.onPrimary,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    gap: theme.space[2],
    height: theme.layout.controlH + theme.space[2],
    justifyContent: 'center',
    marginTop: theme.space[5],
  },
  heroCtaText: {
    color: theme.color.green[800],
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  heroDayBadge: {
    backgroundColor: theme.color.green[800],
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  heroDayText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  heroHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroName: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
    marginTop: theme.space[4],
  },
  heroNext: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    marginTop: theme.space[3],
  },
  heroNextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
    marginTop: theme.space[3],
  },
  heroNextStrong: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  past: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
  },
  pastBody: {
    flex: 1,
  },
  pastDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  pastIcon: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pastMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    marginTop: theme.space[1],
  },
  pastName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  pressed: {
    opacity: 0.72,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[4],
  },
  progressText: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  settledTag: {
    alignItems: 'center',
    backgroundColor: theme.color.green[50],
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[1],
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  settledText: {
    color: theme.color.green[700],
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  track: {
    backgroundColor: theme.color.green[800],
    borderRadius: theme.radius.pill,
    flex: 1,
    height: 6,
    overflow: 'hidden',
  },
  upcoming: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    padding: theme.space[5],
    width: '100%',
    ...theme.shadow.sm,
  },
  upcomingBody: {
    alignItems: 'flex-start',
    flex: 1,
    gap: theme.space[2],
  },
  upcomingMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  upcomingName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
