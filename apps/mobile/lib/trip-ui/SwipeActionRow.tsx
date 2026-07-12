import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { theme } from '../design';
import { buildSwipeActionRowLayout } from '../trips/swipe-action-row-layout';

export function SwipeActionRow({
  actionWidth,
  children,
  renderRightAction,
  style,
}: {
  actionWidth?: number;
  children: ReactNode;
  renderRightAction: (layout: ReturnType<typeof buildSwipeActionRowLayout>) => ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const layout = buildSwipeActionRowLayout(actionWidth);

  return (
    <Swipeable
      childrenContainerStyle={styles.childrenContainer}
      containerStyle={[styles.container, style]}
      friction={1.3}
      overshootRight={false}
      renderRightActions={() => (
        <View
          style={[
            styles.rightActionSurface,
            {
              paddingRight: layout.actionInset,
              width: layout.actionWidth,
            },
          ]}
        >
          {renderRightAction(layout)}
        </View>
      )}
      rightThreshold={layout.rightThreshold}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  childrenContainer: {
    backgroundColor: theme.color.surface,
  },
  container: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  rightActionSurface: {
    alignItems: 'flex-end',
    backgroundColor: theme.color.danger,
    justifyContent: 'center',
  },
});
