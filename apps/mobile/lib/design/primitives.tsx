import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle } from 'react-native';

import { theme } from './theme';

type PlaceTypeKey = keyof typeof theme.placeType;

export type BadgeTone = 'primary' | 'amber' | 'neutral' | 'success' | 'danger';

type ToneColors = { bg: string; fg: string };

const BADGE_TONES: Record<BadgeTone, ToneColors> = {
  primary: { bg: theme.color.primarySoft, fg: theme.color.textStrong },
  amber: { bg: theme.color.accentSoft, fg: theme.color.amber[700] },
  neutral: { bg: theme.color.surfaceSunken, fg: theme.color.textMuted },
  success: { bg: theme.color.primarySoft, fg: theme.color.textStrong },
  danger: { bg: theme.color.red[100], fg: theme.color.danger },
};

export function Badge({
  label,
  tone = 'neutral',
  solid = false,
}: {
  label: string;
  tone?: BadgeTone;
  solid?: boolean;
}) {
  const colors = BADGE_TONES[tone];

  return (
    <View style={[styles.badge, { backgroundColor: solid ? colors.fg : colors.bg }]}>
      <Text style={[styles.badgeText, { color: solid ? theme.color.onPrimary : colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const colors = BADGE_TONES[tone];

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: colors.fg }]} />
      <Text style={[styles.pillText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  leading,
  onPress,
  selected = false,
}: {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  onPress?: PressableProps['onPress'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed ? styles.chipPressed : null,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

type AmountTone = 'credit' | 'debit' | 'neutral';
type AmountSize = 'sm' | 'md' | 'lg' | 'xl';

const AMOUNT_SIZE: Record<AmountSize, number> = {
  sm: theme.font.size.caption,
  md: theme.font.size.body,
  lg: theme.font.size.headline,
  xl: theme.font.size.titleLg,
};

const CURRENCY_SUFFIX: Record<string, string> = {
  JPY: '엔',
  KRW: '원',
};

export function AmountText({
  currency = 'KRW',
  size = 'md',
  style,
  tone = 'neutral',
  value,
}: {
  value: number;
  currency?: 'KRW' | 'JPY' | string;
  tone?: AmountTone;
  size?: AmountSize;
  style?: StyleProp<TextStyle>;
}) {
  const sign = tone === 'credit' ? '+' : tone === 'debit' ? '−' : '';
  const color = tone === 'credit' ? theme.color.credit : tone === 'debit' ? theme.color.debit : theme.color.textStrong;
  const amount = Math.abs(Math.round(value)).toLocaleString('ko-KR');
  const suffix = CURRENCY_SUFFIX[currency] ?? '';

  return (
    <Text style={[styles.amount, { color, fontSize: AMOUNT_SIZE[size] }, style]}>{`${sign}${amount}${suffix}`}</Text>
  );
}

export function PlacePin({
  faded = false,
  order,
  size = 32,
  type,
}: {
  type: PlaceTypeKey;
  order?: number | string;
  size?: number;
  faded?: boolean;
}) {
  return (
    <View
      style={[
        styles.pin,
        {
          backgroundColor: theme.placeType[type].color,
          borderRadius: size / 2,
          height: size,
          opacity: faded ? 0.5 : 1,
          width: size,
        },
      ]}
    >
      {order == null ? null : <Text style={[styles.pinText, { fontSize: size * 0.46 }]}>{order}</Text>}
    </View>
  );
}

export function PlaceTag({ type }: { type: PlaceTypeKey }) {
  const place = theme.placeType[type];

  return (
    <View style={[styles.placeTag, { backgroundColor: tintColor(place.color) }]}>
      <View style={[styles.placeTagDot, { backgroundColor: place.color }]} />
      <Text style={[styles.placeTagText, { color: place.color }]}>{place.label}</Text>
    </View>
  );
}

function tintColor(hex: string): string {
  const color = hex.replace('#', '');
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  const tintRatio = 0.12;
  const blend = (channel: number) => Math.round(channel * tintRatio + 255 * (1 - tintRatio));

  return `rgb(${blend(red)}, ${blend(green)}, ${blend(blue)})`;
}

export function Avatar({
  color = theme.color.primary,
  name,
  ring = theme.color.bg,
  size = 30,
}: {
  name: string;
  color?: string;
  size?: number;
  ring?: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          backgroundColor: color,
          borderColor: ring,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{avatarInitial(name)}</Text>
    </View>
  );
}

function avatarInitial(name: string): string {
  return name.trim().slice(0, 1) || '?';
}

export function AvatarGroup({
  max,
  members,
  overlap,
  size = 30,
}: {
  members: { name: string; color?: string }[];
  size?: number;
  max?: number;
  overlap?: number;
}) {
  const overflowCount = max != null && max > 0 && members.length > max ? members.length - max + 1 : 0;
  const visibleCount = overflowCount > 0 && max != null ? Math.max(max - 1, 0) : members.length;
  const visibleMembers = members.slice(0, visibleCount);
  const overlapAmount = overlap ?? size * 0.3;

  return (
    <View style={styles.avatarGroup}>
      {visibleMembers.map((member, index) => (
        <View key={`${member.name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -overlapAmount }}>
          <Avatar color={member.color} name={member.name} size={size} />
        </View>
      ))}
      {overflowCount > 0 ? (
        <View style={{ marginLeft: visibleMembers.length === 0 ? 0 : -overlapAmount }}>
          <View
            style={[
              styles.avatar,
              styles.avatarOverflow,
              {
                borderRadius: size / 2,
                height: size,
                width: size,
              },
            ]}
          >
            <Text style={[styles.avatarOverflowText, { fontSize: size * 0.34 }]}>+{overflowCount}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ListRow({
  first = false,
  leading,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onPress?: PressableProps['onPress'];
  first?: boolean;
}) {
  const rowStyle = [styles.listRow, first ? null : styles.listRowDivider];
  const content = (
    <>
      {leading}
      <View style={styles.listRowBody}>
        {typeof title === 'string' ? <Text style={styles.listRowTitle}>{title}</Text> : title}
        {subtitle == null ? null : typeof subtitle === 'string' ? (
          <Text style={styles.listRowSubtitle}>{subtitle}</Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...rowStyle, pressed ? styles.listRowPressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

export function SegmentedControl({
  dark = false,
  disabledOptions = [],
  onChange,
  options,
  value,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  dark?: boolean;
  disabledOptions?: string[];
}) {
  return (
    <View style={[styles.segment, dark ? styles.segmentDark : null]}>
      {options.map((option) => {
        const active = option === value;
        const disabled = disabledOptions.includes(option);

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ disabled, selected: active }}
            disabled={disabled}
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.segmentItem,
              active ? (dark ? styles.segmentItemActiveDark : styles.segmentItemActive) : null,
              disabled ? styles.segmentItemDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                dark ? styles.segmentTextDark : null,
                active ? (dark ? styles.segmentTextActiveDark : styles.segmentTextActive) : null,
                disabled ? styles.segmentTextDisabled : null,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    fontFamily: theme.font.family.bold,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.3,
  },
  avatar: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
  },
  avatarGroup: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatarOverflow: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.bg,
  },
  avatarOverflowText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  avatarText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1] + 1,
  },
  badgeText: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  chip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[2],
    height: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
  },
  chipIdle: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  chipPressed: {
    opacity: 0.78,
  },
  chipSelected: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primaryPressed,
    ...theme.shadow.xs,
  },
  chipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  chipTextSelected: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[4],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  listRowBody: {
    flex: 1,
    gap: 2,
  },
  listRowDivider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  listRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  listRowSubtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  listRowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2] + 1,
  },
  pillDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pillText: {
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  placeTag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[2],
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  placeTagDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  placeTagText: {
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  segment: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    gap: theme.space[1],
    padding: theme.space[1] + 2,
  },
  segmentDark: {
    backgroundColor: theme.color.green[800],
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.space[3],
  },
  segmentItemActive: {
    backgroundColor: theme.color.primary,
    ...theme.shadow.xs,
  },
  segmentItemActiveDark: {
    backgroundColor: theme.color.surface,
  },
  segmentItemDisabled: {
    opacity: 0.45,
  },
  segmentText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  segmentTextActive: {
    color: theme.color.onPrimary,
  },
  segmentTextActiveDark: {
    color: theme.color.green[800],
  },
  segmentTextDark: {
    color: theme.color.green[100],
  },
  segmentTextDisabled: {
    color: theme.color.textFaint,
  },
});
