import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, PrimaryButton, ScreenBackground, SecondaryButton, SkeletonCard, theme } from '../design';
import { KeyboardAwareFormScrollView } from './KeyboardAwareFormScrollView';
import { StickyActionFooter, useStickyActionFooterLayout } from './StickyActionFooter';

export function TripScreen({
  children,
  contentContainerStyle,
  footer,
  footerActionCount = 1,
  keyboardAware = false,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  footerActionCount?: number;
  keyboardAware?: boolean;
}) {
  const footerLayout = useStickyActionFooterLayout({ actionCount: footerActionCount });

  return (
    <ScreenBackground style={styles.root}>
      {keyboardAware ? (
        <KeyboardAwareFormScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardFixedBottomOffset={footer ? footerLayout.keyboardFixedBottomOffset : undefined}
          keyboardMinClearance={footer ? footerLayout.keyboardMinClearance : undefined}
          style={styles.scroll}
        >
          {children}
        </KeyboardAwareFormScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]} style={styles.scroll}>
          {children}
        </ScrollView>
      )}
      {footer ? (
        <StickyActionFooter actionCount={footerActionCount} layout={footerLayout}>
          {footer}
        </StickyActionFooter>
      ) : null}
    </ScreenBackground>
  );
}

export function TripScreenHeader({ helper, title }: { title: string; helper?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

type TripStateAction = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
};

export function TripStateCard({
  helper,
  loading = false,
  primaryAction,
  secondaryAction,
  title,
}: {
  title: string;
  helper?: string;
  loading?: boolean;
  primaryAction?: TripStateAction;
  secondaryAction?: TripStateAction;
}) {
  if (loading) {
    return <SkeletonCard title={title} body={helper ?? '화면 구조를 준비하고 있어요.'} />;
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      {helper ? <Text style={styles.cardHelper}>{helper}</Text> : null}
      {primaryAction ? (
        <PrimaryButton
          accessibilityLabel={primaryAction.accessibilityLabel}
          disabled={primaryAction.disabled}
          label={primaryAction.label}
          loading={primaryAction.loading}
          loadingLabel={primaryAction.loadingLabel}
          onPress={primaryAction.onPress}
        />
      ) : null}
      {secondaryAction ? (
        <SecondaryButton
          accessibilityLabel={secondaryAction.accessibilityLabel}
          disabled={secondaryAction.disabled || secondaryAction.loading}
          label={
            secondaryAction.loading ? (secondaryAction.loadingLabel ?? secondaryAction.label) : secondaryAction.label
          }
          onPress={secondaryAction.onPress}
        />
      ) : null}
    </Card>
  );
}

export function TripListCard({ children }: { children: ReactNode }) {
  return <Card style={styles.listCard}>{children}</Card>;
}

const styles = StyleSheet.create({
  cardHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
    textAlign: 'center',
  },
  cardTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  content: {
    alignItems: 'center',
    gap: theme.space[5],
    padding: theme.space[5],
    paddingBottom: theme.space[8],
  },
  header: {
    gap: theme.space[2],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  helper: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  listCard: {
    gap: 0,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  title: {
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.4,
  },
});
