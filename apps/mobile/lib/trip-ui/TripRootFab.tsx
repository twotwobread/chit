import type { PressableProps } from 'react-native';
import { Plus } from 'lucide-react-native';

import { FloatingActionButton, theme } from '../design';
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
    <FloatingActionButton
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={layout}
    >
      <Plus color={theme.color.uiAccent} size={30} strokeWidth={2.8} />
    </FloatingActionButton>
  );
}
