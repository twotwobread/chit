import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card, PrimaryButton, ScreenBackground, SecondaryButton, theme } from '../design';
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
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
}) {
  return (
    <Card>
      {loading ? <ActivityIndicator color={theme.color.primary} /> : null}
      <Text style={styles.cardTitle}>{title}</Text>
      {helper ? <Text style={styles.cardHelper}>{helper}</Text> : null}
      {primaryAction ? <PrimaryButton label={primaryAction.label} onPress={primaryAction.onPress} /> : null}
      {secondaryAction ? <SecondaryButton label={secondaryAction.label} onPress={secondaryAction.onPress} /> : null}
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
