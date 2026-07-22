import type { ReactNode } from 'react';
import { StyleSheet, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '../foundation/interactive-surface';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type SelectableCardMode = 'button' | 'radio' | 'checkbox';

export type SelectableCardProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  checked?: boolean;
  children?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  expanded?: boolean;
  meta?: ReactNode;
  metaPlacement?: 'below' | 'inline';
  mode?: SelectableCardMode;
  onPress: PressableProps['onPress'];
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  title: ReactNode;
  trailing?: ReactNode;
};

export function SelectableCard({
  accessibilityHint,
  accessibilityLabel,
  checked,
  children,
  description,
  disabled,
  expanded,
  meta,
  metaPlacement = 'below',
  mode = 'button',
  onPress,
  selected,
  style,
  title,
  trailing,
}: SelectableCardProps) {
  const active = checked ?? selected ?? false;
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? [textContent(title), textContent(description), textContent(meta)].filter(Boolean).join(', ');

  return (
    <InteractiveSurface
      accessibilityHint={accessibilityHint}
      accessibilityLabel={resolvedAccessibilityLabel || undefined}
      accessibilityRole={selectableCardRole(mode)}
      checked={isCheckedMode(mode) ? active : undefined}
      disabled={disabled}
      expanded={expanded}
      minHeight={theme.layout.controlHLg}
      onPress={onPress}
      selected={!isCheckedMode(mode) ? selected : undefined}
      style={({ disabled: surfaceDisabled, pressed }) => [
        styles.selectableCard,
        style,
        active ? styles.selectableCardSelected : null,
        pressed && !surfaceDisabled ? styles.selectableCardPressed : null,
        surfaceDisabled ? styles.selectableCardDisabled : null,
      ]}
    >
      <View style={styles.selectableCardRow}>
        <View style={styles.selectableCardBody}>
          <View style={styles.selectableCardTitleRow}>
            {renderTextSlot(title, theme.font.size.subhead, [
              styles.selectableCardTitle,
              active ? styles.selectableCardTitleSelected : null,
            ])}
            {meta && metaPlacement === 'inline' ? (
              <View style={styles.selectableCardMetaWrap}>
                {renderTextSlot(meta, theme.font.size.caption, styles.selectableCardMeta)}
              </View>
            ) : null}
          </View>
          {meta && metaPlacement === 'below' ? (
            <View style={styles.selectableCardMetaBelow}>
              {renderTextSlot(meta, theme.font.size.caption, styles.selectableCardMeta)}
            </View>
          ) : null}
          {description ? (
            <View>{renderTextSlot(description, theme.font.size.caption, styles.selectableCardDescription)}</View>
          ) : null}
        </View>
        {trailing ? <View style={styles.selectableCardTrailing}>{trailing}</View> : null}
      </View>
      {children ? <View style={styles.selectableCardChildren}>{children}</View> : null}
    </InteractiveSurface>
  );
}

function selectableCardRole(mode: SelectableCardMode): NonNullable<PressableProps['accessibilityRole']> {
  if (mode === 'radio') {
    return 'radio';
  }
  if (mode === 'checkbox') {
    return 'checkbox';
  }
  return 'button';
}

function isCheckedMode(mode: SelectableCardMode): boolean {
  return mode === 'radio' || mode === 'checkbox';
}

function renderTextSlot(content: ReactNode, fontSize: number, style: StyleProp<TextStyle>): ReactNode {
  if (typeof content === 'string') {
    return (
      <ResponsiveLabel fontSize={fontSize} style={style}>
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
  selectableCard: {
    alignItems: 'stretch',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    gap: theme.space[2],
    minHeight: theme.layout.controlHLg,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  selectableCardBody: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  selectableCardChildren: {
    gap: theme.space[2],
  },
  selectableCardDescription: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  selectableCardDisabled: {
    opacity: 0.5,
  },
  selectableCardMeta: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  selectableCardMetaBelow: {
    alignSelf: 'flex-start',
  },
  selectableCardMetaWrap: {
    flexShrink: 0,
  },
  selectableCardPressed: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderStrong,
  },
  selectableCardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  selectableCardSelected: {
    backgroundColor: theme.color.uiAccentSoft,
    borderColor: theme.color.uiAccent,
  },
  selectableCardTitle: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  selectableCardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  selectableCardTitleSelected: {
    color: theme.color.textStrong,
  },
  selectableCardTrailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    justifyContent: 'center',
  },
});
