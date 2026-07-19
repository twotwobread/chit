import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronRight, MapPin } from 'lucide-react-native';

import { AvatarGroup, Badge, theme } from '../design';

export type ActiveTripCardProps = {
  name: string;
  dayLabel: string;
  dateLabel?: string;
  currencyLabel?: string;
  helperLabel?: string;
  nextPlaceLabel?: string;
  nextTimeLabel?: string;
  completedCount?: number;
  totalCount?: number;
  progressLabel?: string;
  metaLabels?: string[];
  members?: { name: string; color?: string }[];
  ctaLabel?: string;
  onPress: () => void;
};

export type UpcomingTripRowProps = {
  name: string;
  dateLabel: string;
  currencyLabel?: string;
  companionsLabel?: string;
  ddayLabel?: string;
  statusLabel?: string;
  statusTone?: 'amber' | 'neutral' | 'success';
  surfaceTone?: 'default' | 'homeHero';
  metaLabels?: string[];
  onPress: () => void;
};

export type PastTripRowProps = {
  name: string;
  dateLabel: string;
  currencyLabel?: string;
  metaLabels?: string[];
  settledLabel?: string;
  onPress: () => void;
  first?: boolean;
};

export function ActiveTripCard({
  completedCount,
  ctaLabel = '오늘 일정 들어가기',
  currencyLabel,
  dateLabel,
  dayLabel,
  helperLabel,
  members = [],
  metaLabels = [],
  name,
  nextPlaceLabel,
  nextTimeLabel,
  onPress,
  progressLabel,
  totalCount,
}: ActiveTripCardProps) {
  const showProgress = completedCount != null && totalCount != null;
  const progress =
    showProgress && totalCount > 0 ? Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100))) : 0;

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
      {dateLabel ? <Text style={styles.heroDate}>{dateLabel}</Text> : null}
      {currencyLabel ? <Text style={styles.heroMeta}>{currencyLabel}</Text> : null}
      {metaLabels.length > 0 ? (
        <View style={styles.heroMetaRow}>
          {metaLabels.map((label) => (
            <Text key={label} style={styles.heroMetaPill}>
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      {nextPlaceLabel ? (
        <View style={styles.heroNextRow}>
          <MapPin color={theme.color.primary} size={16} strokeWidth={2} />
          <Text numberOfLines={1} style={styles.heroNext}>
            다음 <Text style={styles.heroNextStrong}>{nextPlaceLabel}</Text>
            {nextTimeLabel ? ` · ${nextTimeLabel}` : ''}
          </Text>
        </View>
      ) : helperLabel ? (
        <Text style={styles.heroNext}>{helperLabel}</Text>
      ) : null}

      {showProgress ? (
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progressLabel ?? `${totalCount}곳 중 ${completedCount}곳`}</Text>
        </View>
      ) : null}

      <View style={styles.heroCta}>
        <Text style={styles.heroCtaText}>{ctaLabel}</Text>
        <ChevronRight color={theme.color.onPrimary} size={18} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

export function UpcomingTripRow({
  companionsLabel,
  currencyLabel,
  dateLabel,
  ddayLabel,
  metaLabels = [],
  name,
  onPress,
  statusLabel,
  statusTone = 'amber',
  surfaceTone = 'default',
}: UpcomingTripRowProps) {
  const isHomeHeroSurface = surfaceTone === 'homeHero';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.upcoming,
        isHomeHeroSurface ? styles.upcomingHomeHero : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {ddayLabel ? (
        <View style={styles.ddayBadge}>
          <Text style={styles.ddayCaption}>D-DAY</Text>
          <Text style={styles.ddayText}>{ddayLabel}</Text>
        </View>
      ) : null}
      <View style={styles.upcomingBody}>
        <Text numberOfLines={1} style={[styles.upcomingName, isHomeHeroSurface ? styles.upcomingNameOnHero : null]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[styles.upcomingMeta, isHomeHeroSurface ? styles.upcomingMetaOnHero : null]}>
          {[dateLabel, currencyLabel, companionsLabel].filter(Boolean).join(' · ')}
        </Text>
        {metaLabels.length > 0 ? (
          <View style={styles.rowMetaWrap}>
            {metaLabels.map((label) => (
              <Text key={label} style={[styles.rowMetaLabel, isHomeHeroSurface ? styles.rowMetaLabelOnHero : null]}>
                {label}
              </Text>
            ))}
          </View>
        ) : null}
        {statusLabel ? <Badge label={statusLabel} tone={statusTone === 'success' ? 'success' : statusTone} /> : null}
      </View>
      <ChevronRight color={isHomeHeroSurface ? theme.color.primary : theme.color.textFaint} size={20} strokeWidth={2} />
    </Pressable>
  );
}

export function PastTripRow({
  currencyLabel,
  dateLabel,
  first = false,
  metaLabels = [],
  name,
  onPress,
  settledLabel = '정산 완료',
}: PastTripRowProps) {
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
        <Text style={styles.pastMeta}>{[dateLabel, currencyLabel].filter(Boolean).join(' · ')}</Text>
        {metaLabels.length > 0 ? (
          <View style={styles.rowMetaWrap}>
            {metaLabels.map((label) => (
              <Text key={label} style={styles.rowMetaLabel}>
                {label}
              </Text>
            ))}
          </View>
        ) : null}
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
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    height: '100%',
  },
  hero: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.chit.charcoalElevated,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.md,
  },
  heroCta: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    gap: theme.space[2],
    height: theme.layout.controlH + theme.space[2],
    justifyContent: 'center',
    marginTop: theme.space[5],
  },
  heroCtaText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  heroDate: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    marginTop: theme.space[2],
  },
  heroDayBadge: {
    backgroundColor: theme.color.chit.charcoalElevated,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  heroDayText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  heroHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroMeta: {
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    marginTop: theme.space[1],
  },
  heroMetaPill: {
    color: theme.color.textOnDark,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    marginTop: theme.space[3],
  },
  heroName: {
    color: theme.color.textOnDark,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
    marginTop: theme.space[4],
  },
  heroNext: {
    color: theme.color.chit.acidLimeSofter,
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
    color: theme.color.textOnDark,
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
    gap: theme.space[1],
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
    color: theme.color.chit.acidLimeSofter,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  rowMetaLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rowMetaLabelOnHero: {
    color: theme.color.textOnDark,
  },
  rowMetaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
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
    backgroundColor: theme.color.chit.charcoalElevated,
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
  upcomingHomeHero: {
    backgroundColor: theme.color.chit.charcoal,
    borderColor: theme.color.chit.charcoalElevated,
  },
  upcomingMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  upcomingMetaOnHero: {
    color: theme.color.chit.acidLimeSofter,
  },
  upcomingName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  upcomingNameOnHero: {
    color: theme.color.textOnDark,
  },
});
