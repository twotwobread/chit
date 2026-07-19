import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '../design';
import { ACCOUNT_DELETION_COPY, type AccountDeletionStatus } from './account-deletion-flow';

type AccountDeletionSectionProps = {
  status: AccountDeletionStatus;
  error: string | null;
  onRequest: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AccountDeletionSection({ status, error, onRequest, onCancel, onConfirm }: AccountDeletionSectionProps) {
  const isDeleting = status === 'deleting';

  return (
    <View style={styles.dangerSection}>
      <Text style={styles.dangerTitle}>{ACCOUNT_DELETION_COPY.sectionTitle}</Text>
      {status === 'idle' ? (
        <Pressable
          accessibilityRole="button"
          disabled={isDeleting}
          onPress={onRequest}
          style={[styles.dangerButton, isDeleting ? styles.disabledButton : null]}
        >
          <Text style={styles.dangerButtonText}>{ACCOUNT_DELETION_COPY.cta}</Text>
        </Pressable>
      ) : (
        <View style={styles.confirmationBox}>
          <Text style={styles.confirmationTitle}>{ACCOUNT_DELETION_COPY.confirmationTitle}</Text>
          <Text style={styles.confirmationBody}>{ACCOUNT_DELETION_COPY.confirmationBody}</Text>
          {isDeleting ? <Text style={styles.message}>{ACCOUNT_DELETION_COPY.deleting}</Text> : null}
          {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={[styles.secondaryButton, isDeleting ? styles.disabledButton : null]}
            >
              <Text style={styles.secondaryButtonText}>{ACCOUNT_DELETION_COPY.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onConfirm}
              style={[styles.dangerButton, isDeleting ? styles.disabledButton : null]}
            >
              <Text style={styles.dangerButtonText}>
                {isDeleting ? ACCOUNT_DELETION_COPY.deleting : ACCOUNT_DELETION_COPY.confirm}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.space[4],
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  dangerSection: {
    alignSelf: 'stretch',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.danger,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[5],
  },
  dangerTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  confirmationBox: {
    gap: theme.space[4],
  },
  confirmationTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  confirmationBody: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'left',
  },
  secondaryButton: {
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  secondaryButtonText: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: theme.color.danger,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[3],
  },
  dangerButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
