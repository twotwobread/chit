import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { buildCriticalTextLayout, buildNonCriticalTextLayout } from '../responsive-text';
import { theme } from '../theme';

export type ActionRowTone = 'default' | 'danger';

export function ActionRow({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  leading,
  meta,
  onPress,
  selected,
  style,
  subtitle,
  title,
  tone = 'default',
  trailing,
}: {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  leading?: ReactNode;
  meta?: string;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
  tone?: ActionRowTone;
  trailing?: ReactNode;
}) {
  const resolvedAccessibilityLabel = accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(', ');

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      minHeight={theme.layout.controlHLg}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.actionRow,
        selected ? styles.actionRowSelected : null,
        tone === 'danger' ? styles.actionRowDanger : null,
        pressed && !disabled ? styles.actionRowPressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {leading ? <View style={styles.actionRowLeading}>{leading}</View> : null}
      <View style={styles.actionRowBody}>
        <ResponsiveLabel
          fontSize={theme.font.size.body}
          style={[styles.actionRowTitle, tone === 'danger' ? styles.actionRowTitleDanger : null]}
        >
          {title}
        </ResponsiveLabel>
        {subtitle ? (
          <ResponsiveLabel fontSize={theme.font.size.caption} style={styles.actionRowSubtitle}>
            {subtitle}
          </ResponsiveLabel>
        ) : null}
      </View>
      {meta ? (
        <ResponsiveLabel fontSize={theme.font.size.caption} style={styles.actionRowMeta}>
          {meta}
        </ResponsiveLabel>
      ) : null}
      {trailing}
    </InteractiveSurface>
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
          <ResponsiveLabel fontSize={theme.font.size.body} style={styles.listRowTitle}>
            {title}
          </ResponsiveLabel>
        ) : (
          title
        )}
        {subtitle == null ? null : typeof subtitle === 'string' ? (
          <ResponsiveLabel
            accessibilityLabel={subtitle}
            fontSize={theme.font.size.caption}
            numberOfLines={subtitleLayout.numberOfLines}
            style={styles.listRowSubtitle}
          >
            {subtitle}
          </ResponsiveLabel>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </>
  );

  if (onPress) {
    return (
      <InteractiveSurface
        accessibilityRole="button"
        minHeight={titleLayout.minHeight}
        onPress={onPress}
        style={({ pressed }) => [...rowStyle, pressed ? styles.listRowPressed : null]}
      >
        {content}
      </InteractiveSurface>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    minHeight: theme.layout.controlHLg,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  actionRowBody: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  actionRowDanger: {
    borderColor: theme.color.red[100],
  },
  actionRowLeading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  actionRowMeta: {
    color: theme.color.textMuted,
    flexShrink: 0,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  actionRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  actionRowSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  actionRowSubtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  actionRowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  actionRowTitleDanger: {
    color: theme.color.danger,
  },
  disabled: {
    opacity: 0.5,
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
});
