import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

const selectableListRowImageSize = theme.layout.tapMin - theme.space[1];

export type SelectableListRowProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  actionLabel?: string;
  disabled?: boolean;
  imageAccessibilityLabel?: string;
  imageSource?: ImageSourcePropType;
  leading?: ReactNode;
  onPress?: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
};

export function SelectableListRow({
  accessibilityHint,
  accessibilityLabel,
  actionLabel,
  disabled,
  imageAccessibilityLabel,
  imageSource,
  leading,
  onPress,
  selected,
  style,
  subtitle,
  title,
  trailing,
}: SelectableListRowProps) {
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? [textContent(title), textContent(subtitle), actionLabel].filter(Boolean).join(', ');

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={resolvedAccessibilityLabel || undefined}
      accessibilityRole="button"
      disabled={disabled}
      minHeight={theme.layout.controlHLg}
      onPress={onPress}
      selected={selected}
      style={({ pressed }) => [
        styles.selectableListRow,
        selected ? styles.selectableListRowSelected : null,
        pressed && !disabled ? styles.selectableListRowPressed : null,
        disabled ? styles.selectableListRowDisabled : null,
        style,
      ]}
    >
      {imageSource ? (
        <View style={styles.selectableListRowImageFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={imageAccessibilityLabel}
            accessible={Boolean(imageAccessibilityLabel)}
            source={imageSource}
            style={styles.selectableListRowImage}
          />
        </View>
      ) : null}
      {leading}
      <View style={styles.selectableListRowBody}>
        {renderTextSlot(title, theme.font.size.subhead, styles.selectableListRowTitle)}
        {subtitle ? renderTextSlot(subtitle, theme.font.size.caption, styles.selectableListRowSubtitle) : null}
      </View>
      {trailing ??
        (actionLabel ? <View style={styles.selectableListRowActionPill}>{renderActionLabel(actionLabel)}</View> : null)}
    </InteractiveSurface>
  );
}

function renderActionLabel(label: string): ReactNode {
  return (
    <ResponsiveLabel fontSize={theme.font.size.label} style={styles.selectableListRowActionText}>
      {label}
    </ResponsiveLabel>
  );
}

function renderTextSlot(content: ReactNode, fontSize: number, style: StyleProp<TextStyle>): ReactNode {
  if (typeof content === 'string') {
    return (
      <ResponsiveLabel fontSize={fontSize} numberOfLines={1} style={style}>
        {content}
      </ResponsiveLabel>
    );
  }

  return content;
}

function textContent(content: ReactNode): string | null {
  return typeof content === 'string' ? content : null;
}

const styles = StyleSheet.create({
  selectableListRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.controlHLg,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  selectableListRowActionPill: {
    alignItems: 'center',
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.actionPrimary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlHSm,
    paddingHorizontal: theme.space[4],
  },
  selectableListRowActionText: {
    color: theme.color.onActionPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  selectableListRowBody: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  selectableListRowDisabled: {
    opacity: 0.5,
  },
  selectableListRowImage: {
    height: selectableListRowImageSize,
    width: selectableListRowImageSize,
  },
  selectableListRowImageFrame: {
    borderRadius: selectableListRowImageSize / 2,
    height: selectableListRowImageSize,
    overflow: 'hidden',
    width: selectableListRowImageSize,
  },
  selectableListRowPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  selectableListRowSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  selectableListRowSubtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  selectableListRowTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
