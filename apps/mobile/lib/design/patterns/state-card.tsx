import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type PressableProps } from 'react-native';

import { BrandStamp } from '../components/card';
import { SecondaryButton } from '../components/button';
import { ResponsiveLabel } from '../foundation/responsive-label';
import { theme } from '../theme';

export type StateAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: PressableProps['onPress'];
};

export function EmptyState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return <StatusStateCard action={action} body={body} title={title} visual={<BrandStamp decorative size="sm" />} />;
}

export function ErrorState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return (
    <StatusStateCard
      action={action}
      body={body}
      title={title}
      tone="danger"
      visual={<View style={styles.statusSignalDanger} />}
    />
  );
}

export function LoadingState({ action, body, title }: { action?: StateAction; body?: string; title: string }) {
  return (
    <StatusStateCard
      action={action}
      body={body}
      title={title}
      visual={<ActivityIndicator color={theme.color.textStrong} />}
    />
  );
}

export function SkeletonCard({
  body = '콘텐츠 구조를 먼저 준비하고 있어요.',
  rowCount = 3,
  title = '불러오는 중...',
}: {
  body?: string;
  rowCount?: number;
  title?: string;
}) {
  const rows = Array.from({ length: clampSkeletonRows(rowCount) });

  return (
    <View
      accessibilityLabel={`${title} ${body}`}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[styles.statusCard, styles.skeletonCard]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.skeletonVisual}>
        <View style={styles.skeletonDot} />
        <View style={styles.skeletonHeaderLine} />
      </View>
      <ResponsiveLabel fontSize={theme.font.size.headline} leading={theme.font.leading.snug} style={styles.statusTitle}>
        {title}
      </ResponsiveLabel>
      <ResponsiveLabel fontSize={theme.font.size.body} style={styles.statusBody}>
        {body}
      </ResponsiveLabel>
      <View accessibilityElementsHidden importantForAccessibility="no" style={styles.skeletonStack}>
        {rows.map((_, index) => (
          <View key={index} style={[styles.skeletonRow, index === rows.length - 1 ? styles.skeletonRowShort : null]} />
        ))}
      </View>
    </View>
  );
}

function StatusStateCard({
  action,
  body,
  title,
  tone = 'default',
  visual,
}: {
  action?: StateAction;
  body?: string;
  title: string;
  tone?: 'default' | 'danger';
  visual?: ReactNode;
}) {
  return (
    <View style={[styles.statusCard, tone === 'danger' ? styles.statusCardDanger : null]}>
      {visual ? <View style={styles.statusVisual}>{visual}</View> : null}
      <ResponsiveLabel
        fontSize={theme.font.size.headline}
        leading={theme.font.leading.snug}
        style={[styles.statusTitle, tone === 'danger' ? styles.statusTitleDanger : null]}
      >
        {title}
      </ResponsiveLabel>
      {body ? (
        <ResponsiveLabel fontSize={theme.font.size.body} style={styles.statusBody}>
          {body}
        </ResponsiveLabel>
      ) : null}
      {action ? (
        <View style={styles.statusAction}>
          <SecondaryButton
            accessibilityLabel={action.accessibilityLabel}
            disabled={action.disabled}
            label={action.label}
            onPress={action.onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

function clampSkeletonRows(rowCount: number): number {
  if (!Number.isFinite(rowCount)) {
    return 3;
  }
  return Math.max(1, Math.min(6, Math.round(rowCount)));
}

const styles = StyleSheet.create({
  skeletonCard: {
    alignItems: 'stretch',
  },
  skeletonDot: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: theme.layout.tapMin,
    width: theme.layout.tapMin,
  },
  skeletonHeaderLine: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flex: 1,
    height: theme.space[4],
  },
  skeletonRow: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    height: theme.space[4],
    width: '100%',
  },
  skeletonRowShort: {
    width: '64%',
  },
  skeletonStack: {
    gap: theme.space[3],
    width: '100%',
  },
  skeletonVisual: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
    width: '100%',
  },
  statusAction: {
    alignSelf: 'stretch',
    marginTop: theme.space[2],
  },
  statusBody: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[7],
    width: '100%',
    ...theme.shadow.sm,
  },
  statusCardDanger: {
    borderColor: theme.color.red[100],
  },
  statusSignalDanger: {
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.pill,
    height: theme.space[5],
    width: theme.space[5],
  },
  statusTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  statusTitleDanger: {
    color: theme.color.danger,
  },
  statusVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
});
