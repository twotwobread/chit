import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps } from 'react-native';
import { Plus } from 'lucide-react-native';

import { theme } from '../design';
import type { TripRootFabLayout } from '../trips/trip-root-fab-layout';

export function TripRootFab({
  accessibilityHint,
  accessibilityLabel,
  layout,
  onPress,
}: {
  accessibilityHint: string;
  accessibilityLabel: string;
  layout: TripRootFabLayout['fab'];
  onPress: PressableProps['onPress'];
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={theme.space[3]}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, layout, pressed ? styles.fabPressed : null]}
    >
      <Plus color={theme.color.onPrimary} size={30} strokeWidth={2.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
    position: 'absolute',
    width: theme.layout.controlHLg,
    zIndex: 10,
    ...theme.shadow.lg,
  },
  fabPressed: {
    backgroundColor: theme.color.primaryPressed,
  },
});
