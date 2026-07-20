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

const styles = StyleSheet.create({
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
