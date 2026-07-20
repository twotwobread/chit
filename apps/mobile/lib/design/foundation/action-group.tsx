import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
  return <View style={[styles.base, direction === 'row' ? styles.row : styles.column, style]}>{children}</View>;
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
    flexWrap: 'wrap',
  },
});
