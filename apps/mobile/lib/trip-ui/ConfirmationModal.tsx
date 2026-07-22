import { Modal, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { PrimaryButton, SecondaryButton, theme } from '../design';

export type ConfirmationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: PressableProps['onPress'];
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmLoadingLabel?: string;
};

export function ConfirmationModal({
  cancelLabel,
  confirmDisabled,
  confirmLabel,
  confirmLoading,
  confirmLoadingLabel,
  message,
  onCancel,
  onConfirm,
  title,
  visible,
}: ConfirmationModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="팝업 닫기" accessibilityRole="button" onPress={onCancel} style={styles.scrim} />
        <View accessibilityViewIsModal importantForAccessibility="yes" style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <SecondaryButton
              disabled={confirmLoading}
              label={cancelLabel}
              onPress={onCancel}
              style={styles.actionButton}
            />
            <PrimaryButton
              disabled={confirmDisabled}
              label={confirmLabel}
              loading={confirmLoading}
              loadingLabel={confirmLoadingLabel ?? confirmLabel}
              onPress={onConfirm}
              style={styles.actionButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1,
    minHeight: theme.layout.tapMin,
    minWidth: theme.layout.tapMin,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  card: {
    backgroundColor: theme.color.shellElevated,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    borderWidth: 1,
    gap: theme.space[4],
    marginHorizontal: theme.space[5],
    maxWidth: theme.layout.cardMaxW,
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.lg,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: theme.space[5],
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.color.ink[900],
    opacity: 0.58,
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
