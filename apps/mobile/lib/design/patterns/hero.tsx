import type { ReactNode } from 'react';
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ActionGroup } from '../foundation/action-group';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { SurfaceFrame } from '../foundation/surface-frame';
import { PrimaryButton, type PrimaryButtonTone, SecondaryButton } from '../components/button';
import { theme } from '../theme';

export type HeroCardVariant = 'panel' | 'graphite' | 'split';
export type HeroMetricPanelTone = 'graphite' | 'neutral';
export type HeroAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: PressableProps['onPress'];
  tone?: PrimaryButtonTone;
};

export function HeroCard({
  children,
  footer,
  header,
  style,
  variant = 'panel',
}: {
  children?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: HeroCardVariant;
}) {
  if (variant === 'split') {
    return (
      <View style={[styles.heroCard, styles.heroCardSplit, style]}>
        {header ? <View style={styles.heroSplitHeader}>{header}</View> : null}
        <View style={styles.heroSplitBody}>{children}</View>
        {footer ? <View style={styles.heroFooter}>{footer}</View> : null}
      </View>
    );
  }

  return (
    <SurfaceFrame
      style={[styles.heroCard, variant === 'graphite' ? styles.heroCardGraphite : styles.heroCardPanel, style]}
      variant={variant === 'graphite' ? 'graphite' : 'hero'}
    >
      {header}
      {children}
      {footer ? <View style={styles.heroFooter}>{footer}</View> : null}
    </SurfaceFrame>
  );
}

export function HeroHeader({
  body,
  eyebrow,
  meta,
  onDark = false,
  title,
}: {
  body?: string;
  eyebrow?: string;
  meta?: ReactNode;
  onDark?: boolean;
  title: string;
}) {
  return (
    <View style={styles.heroHeader}>
      {eyebrow ? (
        <ResponsiveLabel
          fontSize={theme.font.size.micro}
          style={[styles.heroEyebrow, onDark ? styles.heroEyebrowOnDark : null]}
        >
          {eyebrow}
        </ResponsiveLabel>
      ) : null}
      <ResponsiveLabel
        fontSize={theme.font.size.titleLg}
        leading={theme.font.leading.tight}
        style={[styles.heroTitle, onDark ? styles.heroTitleOnDark : null]}
      >
        {title}
      </ResponsiveLabel>
      {body ? (
        <ResponsiveLabel
          fontSize={theme.font.size.label}
          style={[styles.heroBody, onDark ? styles.heroBodyOnDark : null]}
        >
          {body}
        </ResponsiveLabel>
      ) : null}
      {meta}
    </View>
  );
}

export function HeroMetricPanel({
  helper,
  label,
  tone = 'graphite',
  value,
}: {
  helper?: string;
  label: string;
  tone?: HeroMetricPanelTone;
  value: string;
}) {
  const graphite = tone === 'graphite';

  return (
    <View style={[styles.metricPanel, graphite ? styles.metricPanelGraphite : styles.metricPanelNeutral]}>
      <ResponsiveLabel
        fontSize={theme.font.size.micro}
        style={graphite ? styles.metricLabelGraphite : styles.metricLabel}
      >
        {label}
      </ResponsiveLabel>
      <ResponsiveLabel
        fontSize={theme.font.size.titleLg}
        leading={theme.font.leading.tight}
        style={graphite ? styles.metricValueGraphite : styles.metricValue}
      >
        {value}
      </ResponsiveLabel>
      {helper ? (
        <ResponsiveLabel
          fontSize={theme.font.size.caption}
          style={graphite ? styles.metricHelperGraphite : styles.metricHelper}
        >
          {helper}
        </ResponsiveLabel>
      ) : null}
    </View>
  );
}

export function HeroActions({ primary, secondary }: { primary: HeroAction; secondary?: HeroAction }) {
  const primaryAction = { tone: 'lime' as PrimaryButtonTone, ...primary };

  return (
    <ActionGroup direction={secondary ? 'row' : 'column'} style={styles.heroActions}>
      <PrimaryButton
        accessibilityLabel={primaryAction.accessibilityLabel}
        disabled={primaryAction.disabled}
        label={primaryAction.label}
        loading={primaryAction.loading}
        loadingLabel={primaryAction.loadingLabel}
        onPress={primaryAction.onPress}
        style={styles.heroActionButton}
        tone={primaryAction.tone}
      />
      {secondary ? (
        <SecondaryButton
          accessibilityLabel={secondary.accessibilityLabel}
          disabled={secondary.disabled || secondary.loading}
          label={secondary.loading ? (secondary.loadingLabel ?? secondary.label) : secondary.label}
          onPress={secondary.onPress}
          style={styles.heroActionButton}
        />
      ) : null}
    </ActionGroup>
  );
}

const styles = StyleSheet.create({
  heroActionButton: {
    flex: 1,
  },
  heroActions: {
    alignSelf: 'stretch',
  },
  heroBody: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  heroBodyOnDark: {
    color: theme.color.textOnShellMuted,
  },
  heroCard: {
    width: '100%',
  },
  heroCardGraphite: {
    backgroundColor: theme.color.actionPrimary,
    borderColor: theme.color.shellRaised,
  },
  heroCardPanel: {
    backgroundColor: theme.color.surface,
  },
  heroCardSplit: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    maxWidth: theme.layout.cardMaxW,
    overflow: 'hidden',
    width: '100%',
    ...theme.shadow.md,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  heroEyebrowOnDark: {
    backgroundColor: theme.color.shellElevated,
    color: theme.color.textOnShell,
  },
  heroFooter: {
    marginTop: theme.space[1],
  },
  heroHeader: {
    gap: theme.space[3],
  },
  heroSplitBody: {
    gap: theme.space[4],
    padding: theme.space[5],
  },
  heroSplitHeader: {
    backgroundColor: theme.color.actionPrimary,
    gap: theme.space[3],
    padding: theme.space[6],
  },
  heroTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.6,
  },
  heroTitleOnDark: {
    color: theme.color.textOnShell,
  },
  metricHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metricHelperGraphite: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metricLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  metricLabelGraphite: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  metricPanel: {
    borderRadius: theme.radius.lg,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  metricPanelGraphite: {
    backgroundColor: theme.color.actionPrimary,
  },
  metricPanelNeutral: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderWidth: 1,
  },
  metricValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
  },
  metricValueGraphite: {
    color: theme.color.onActionPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
  },
});
