import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../design';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
};

export function BottomSheet({ children, onClose, showCloseButton = true, visible }: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.scrim} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.space[6]) }]}>
          {showCloseButton ? (
            <Pressable
              accessibilityLabel="닫기"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
            >
              <X color={theme.color.textMuted} size={19} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          <View style={styles.grabber} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: theme.space[5],
    top: theme.space[4],
    width: 32,
    zIndex: 1,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: theme.color.ink[200],
    borderRadius: 2,
    height: 4,
    marginBottom: theme.space[5],
    width: 40,
  },
  pressed: {
    opacity: 0.7,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.ink[900],
    opacity: 0.42,
  },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius['2xl'],
    borderTopRightRadius: theme.radius['2xl'],
    maxHeight: '86%',
    paddingHorizontal: theme.space[6],
    paddingTop: theme.space[4],
    ...theme.shadow.lg,
  },
});
