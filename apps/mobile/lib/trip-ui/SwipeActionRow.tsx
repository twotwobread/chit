import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { buildSwipeActionRowLayout } from '../trips/swipe-action-row-layout';

export function SwipeActionRow({
  actionWidth,
  children,
  renderRightAction,
}: {
  actionWidth?: number;
  children: ReactNode;
  renderRightAction: () => ReactNode;
}) {
  const layout = buildSwipeActionRowLayout(actionWidth);

  return (
    <Swipeable
      containerStyle={styles.container}
      friction={1.3}
      overshootRight={false}
      renderRightActions={() => (
        <View style={[styles.rightActionSlot, { width: layout.actionWidth }]}>{renderRightAction()}</View>
      )}
      rightThreshold={layout.rightThreshold}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  rightActionSlot: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
