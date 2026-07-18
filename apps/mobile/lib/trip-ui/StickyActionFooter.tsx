import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design/theme';
import {
  buildStickyActionFooterLayout,
  type StickyActionFooterLayout,
  type StickyActionFooterLayoutInput,
} from './sticky-action-footer-layout';

export type StickyActionFooterProps = {
  accessibilityLabel?: string;
  actionCount?: StickyActionFooterLayoutInput['actionCount'];
  children: ReactNode;
  innerStyle?: StyleProp<ViewStyle>;
  layout?: StickyActionFooterLayout;
  style?: StyleProp<ViewStyle>;
};

export function useStickyActionFooterLayout({ bottomSafeArea, ...input }: StickyActionFooterLayoutInput = {}) {
  const insets = useSafeAreaInsets();

  return buildStickyActionFooterLayout({
    ...input,
    bottomSafeArea: bottomSafeArea ?? insets.bottom,
  });
}

export function StickyActionFooter({
  accessibilityLabel = '화면 하단 작업 버튼',
  actionCount = 1,
  children,
  innerStyle,
  layout,
  style,
}: StickyActionFooterProps) {
  const fallbackLayout = useStickyActionFooterLayout({ actionCount });
  const footerLayout = layout ?? fallbackLayout;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.footer,
        { paddingBottom: footerLayout.footerPaddingBottom, paddingTop: footerLayout.footerPaddingTop },
        style,
      ]}
    >
      <View style={[styles.inner, { gap: footerLayout.footerActionGap }, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: theme.color.surface,
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: theme.space[5],
    position: 'absolute',
    right: 0,
    zIndex: 10,
    ...theme.shadow.md,
  },
  inner: {
    alignSelf: 'center',
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
});
