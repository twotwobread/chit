import { StyleSheet, View } from 'react-native';

import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

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

  return (
    <View style={[styles.badge, { backgroundColor: solid ? colors.fg : colors.bg }]}>
      <ResponsiveLabel
        accessibilityLabel={accessibilityLabel ?? label}
        fontSize={theme.font.size.micro}
        style={[styles.badgeText, { color: solid ? theme.color.onPrimary : colors.fg }]}
      >
        {label}
      </ResponsiveLabel>
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

  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: colors.fg }]} />
      <ResponsiveLabel
        accessibilityLabel={accessibilityLabel ?? label}
        fontSize={theme.font.size.caption}
        style={[styles.pillText, { color: colors.fg }]}
      >
        {label}
      </ResponsiveLabel>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
