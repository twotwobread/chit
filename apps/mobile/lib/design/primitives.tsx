import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { buildCriticalTextLayout, buildNonCriticalTextLayout, buildResponsiveLineHeight } from './responsive-text';
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
  accessibilityLabel,
  label,
  tone = 'neutral',
  solid = false,
}: {
  label: string;
  tone?: BadgeTone;
  solid?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = BADGE_TONES[tone];
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.micro, fontScale });

  return (
    <View style={[styles.badge, { backgroundColor: solid ? colors.fg : colors.bg }]}>
      <Text
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.badgeText, { color: solid ? theme.color.onPrimary : colors.fg, lineHeight }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Pill({
  accessibilityLabel,
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
  accessibilityLabel?: string;
}) {
  const colors = BADGE_TONES[tone];
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.caption, fontScale });

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: colors.fg }]} />
      <Text
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.pillText, { color: colors.fg, lineHeight }]}
      >
        {label}
      </Text>
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
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.controlHSm,
    verticalPadding: theme.space[2],
  });

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { minHeight: textLayout.minHeight },
        selected ? styles.chipSelected : styles.chipIdle,
        pressed ? styles.chipPressed : null,
      ]}
    >
      {leading}
      <Text style={[styles.chipText, { lineHeight: textLayout.lineHeight }, selected ? styles.chipTextSelected : null]}>
        {label}
      </Text>
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

export function formatAmountText({
  currency = 'KRW',
  tone = 'neutral',
  value,
}: {
  value: number;
  currency?: 'KRW' | 'JPY' | string;
  tone?: AmountTone;
}): string {
  const sign = tone === 'credit' ? '+' : tone === 'debit' ? '−' : '';
  const amount = Math.abs(Math.round(value)).toLocaleString('ko-KR');
  const suffix = CURRENCY_SUFFIX[currency] ?? '';

  return `${sign}${amount}${suffix}`;
}

export function AmountText({
  accessibilityLabel,
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
  accessibilityLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const color = tone === 'credit' ? theme.color.credit : tone === 'debit' ? theme.color.debit : theme.color.textStrong;
  const label = formatAmountText({ currency, tone, value });
  const fontSize = AMOUNT_SIZE[size];
  const lineHeight = buildResponsiveLineHeight({ fontSize, fontScale, leading: theme.font.leading.tight });

  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.amount, { color, fontSize, lineHeight }, style]}
    >
      {label}
    </Text>
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
  const { fontScale } = useWindowDimensions();
  const lineHeight = buildResponsiveLineHeight({ fontSize: theme.font.size.caption, fontScale });

  return (
    <View style={[styles.placeTag, { backgroundColor: tintColor(place.color) }]}>
      <View style={[styles.placeTagDot, { backgroundColor: place.color }]} />
      <Text style={[styles.placeTagText, { color: place.color, lineHeight }]}>{place.label}</Text>
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
  const { fontScale } = useWindowDimensions();
  const titleLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.body,
    fontScale,
    verticalPadding: theme.space[4],
  });
  const subtitleLayout = buildNonCriticalTextLayout({
    fontSize: theme.font.size.caption,
    fontScale,
    maxLines: 2,
  });
  const rowStyle = [styles.listRow, { minHeight: titleLayout.minHeight }, first ? null : styles.listRowDivider];
  const content = (
    <>
      {leading}
      <View style={styles.listRowBody}>
        {typeof title === 'string' ? (
          <Text style={[styles.listRowTitle, { lineHeight: titleLayout.lineHeight }]}>{title}</Text>
        ) : (
          title
        )}
        {subtitle == null ? null : typeof subtitle === 'string' ? (
          <Text
            accessibilityLabel={subtitle}
            ellipsizeMode={subtitleLayout.ellipsizeMode}
            numberOfLines={subtitleLayout.numberOfLines}
            style={[styles.listRowSubtitle, { lineHeight: subtitleLayout.lineHeight }]}
          >
            {subtitle}
          </Text>
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
  const { fontScale } = useWindowDimensions();
  const textLayout = buildCriticalTextLayout({
    fontSize: theme.font.size.label,
    fontScale,
    minHeight: theme.layout.tapMin,
    verticalPadding: theme.space[3],
  });

  return (
    <View style={[styles.segment, dark ? styles.segmentDark : null]}>
      {options.map((option) => {
        const active = option === value;
        const disabled = disabledOptions.includes(option);

        return (
          <Pressable
            accessibilityLabel={option}
            accessibilityRole="tab"
            accessibilityState={{ disabled, selected: active }}
            disabled={disabled}
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.segmentItem,
              { minHeight: textLayout.minHeight },
              active ? (dark ? styles.segmentItemActiveDark : styles.segmentItemActive) : null,
              disabled ? styles.segmentItemDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { lineHeight: textLayout.lineHeight },
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
    flexShrink: 0,
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
    maxWidth: '100%',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1] + 1,
  },
  badgeText: {
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  chip: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
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
    flexShrink: 1,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
  chipTextSelected: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[4],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  listRowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
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
    flexWrap: 'wrap',
    gap: theme.space[2],
    maxWidth: '100%',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2] + 1,
  },
  pillDot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  pillText: {
    flexShrink: 1,
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
    flexWrap: 'wrap',
    gap: theme.space[2],
    maxWidth: '100%',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  placeTagDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  placeTagText: {
    flexShrink: 1,
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
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[2],
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
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
