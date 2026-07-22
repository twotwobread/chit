import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { buildResponsiveTextProfile } from '../responsive-text';
import { theme } from '../theme';

export type ActionGroupDirection = 'row' | 'column';

export function ActionGroup({
  children,
  direction = 'column',
  style,
}: {
  children: ReactNode;
  direction?: ActionGroupDirection;
  style?: StyleProp<ViewStyle>;
}) {
  const { fontScale, width } = useWindowDimensions();
  const profile = buildResponsiveTextProfile({ fontScale, width });
  const shouldStackRow = direction === 'row' && profile.prefersStackedContent;
  const resolvedDirection = direction === 'row' && !shouldStackRow ? styles.row : styles.column;

  return <View style={[styles.base, resolvedDirection, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    gap: theme.space[3],
  },
  column: {
    alignSelf: 'stretch',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
