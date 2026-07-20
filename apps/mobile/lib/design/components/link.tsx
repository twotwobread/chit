import type { ReactNode } from 'react';
import { StyleSheet, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type TextLinkTone = 'info' | 'strong' | 'danger' | 'muted';
export type InlineActionTone = 'neutral' | 'primary' | 'danger';

export function TextLink({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  label,
  onPress,
  style,
  textStyle,
  tone = 'info',
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: TextLinkTone;
}) {
  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="link"
      disabled={disabled}
      minHeight={theme.layout.tapMin}
      minWidth={theme.layout.tapMin}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textLinkHitArea,
        pressed && !disabled ? styles.textLinkPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <ResponsiveLabel
        fontSize={theme.font.size.label}
        style={[styles.textLinkText, textLinkToneStyle(tone), textStyle]}
      >
        {label}
      </ResponsiveLabel>
    </InteractiveSurface>
  );
}

export function InlineAction({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  expanded,
  label,
  leading,
  onPress,
  selected,
  style,
  tone = 'neutral',
  trailing,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  expanded?: boolean;
  label: string;
  leading?: ReactNode;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: InlineActionTone;
  trailing?: ReactNode;
}) {
  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      expanded={expanded}
      minHeight={theme.layout.controlHSm}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.inlineAction,
        inlineActionToneStyle(tone),
        pressed && !disabled ? styles.inlineActionPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leading}
      <ResponsiveLabel
        fontSize={theme.font.size.label}
        style={[styles.inlineActionText, inlineActionTextToneStyle(tone)]}
      >
        {label}
      </ResponsiveLabel>
      {trailing}
    </InteractiveSurface>
  );
}

function textLinkToneStyle(tone: TextLinkTone): StyleProp<TextStyle> {
  if (tone === 'danger') return styles.textLinkTextDanger;
  if (tone === 'muted') return styles.textLinkTextMuted;
  if (tone === 'strong') return styles.textLinkTextStrong;
  return styles.textLinkTextInfo;
}

function inlineActionToneStyle(tone: InlineActionTone): StyleProp<ViewStyle> {
  if (tone === 'primary') return styles.inlineActionPrimary;
  if (tone === 'danger') return styles.inlineActionDanger;
  return styles.inlineActionNeutral;
}

function inlineActionTextToneStyle(tone: InlineActionTone): StyleProp<TextStyle> {
  if (tone === 'primary') return styles.inlineActionTextPrimary;
  if (tone === 'danger') return styles.inlineActionTextDanger;
  return styles.inlineActionTextNeutral;
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  inlineAction: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  inlineActionDanger: {
    backgroundColor: theme.color.red[100],
    borderColor: theme.color.red[100],
  },
  inlineActionNeutral: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
  },
  inlineActionPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  inlineActionPrimary: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.actionPrimary,
  },
  inlineActionText: {
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  inlineActionTextDanger: {
    color: theme.color.danger,
  },
  inlineActionTextNeutral: {
    color: theme.color.textStrong,
  },
  inlineActionTextPrimary: {
    color: theme.color.onActionPrimary,
  },
  textLinkHitArea: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
    paddingHorizontal: theme.space[1],
    paddingVertical: theme.space[2],
  },
  textLinkPressed: {
    opacity: 0.68,
  },
  textLinkText: {
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    textDecorationLine: 'underline',
  },
  textLinkTextDanger: {
    color: theme.color.danger,
  },
  textLinkTextInfo: {
    color: theme.color.textLink,
  },
  textLinkTextMuted: {
    color: theme.color.textMuted,
  },
  textLinkTextStrong: {
    color: theme.color.textStrong,
  },
});
