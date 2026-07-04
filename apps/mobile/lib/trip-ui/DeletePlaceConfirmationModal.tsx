import { useEffect, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

import { theme } from '../design';
import {
  buildDayItineraryDeleteConfirmation,
  buildDayItineraryDeleteSubmitState,
  canDismissDayItineraryDeleteModal,
} from '../trips/day-itinerary-edit';
import { focusAccessibilityNode } from './accessibility-focus';
import { styles } from './DayItineraryEditorStyles';
import type { DeletePlaceConfirmationState } from './DayItineraryEditorTypes';

export function DeletePlaceConfirmationModal({
  deleteState,
  onCancel,
  onConfirm,
}: {
  deleteState: DeletePlaceConfirmationState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeleting = deleteState.status === 'deleting';
  const confirmation = buildDayItineraryDeleteConfirmation(deleteState.item);
  const submitView = buildDayItineraryDeleteSubmitState(isDeleting);
  const titleRef = useRef<Text>(null);
  const errorRef = useRef<View>(null);

  useEffect(() => {
    if (isDeleting) {
      return;
    }

    if (deleteState.error) {
      focusAccessibilityNode(errorRef.current);
      AccessibilityInfo.announceForAccessibility(`${deleteState.error.title}. ${deleteState.error.helper}`);
      return;
    }

    focusAccessibilityNode(titleRef.current);
  }, [deleteState.error, deleteState.item.id, isDeleting]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (canDismissDayItineraryDeleteModal(deleteState.status)) {
          onCancel();
        }
      }}
      transparent
      visible
    >
      <View style={styles.modalBackdrop}>
        <View accessibilityViewIsModal importantForAccessibility="yes" style={styles.modalCard}>
          <Text ref={titleRef} accessibilityRole="header" style={styles.modalTitle}>
            {confirmation.title}
          </Text>
          <View style={styles.deleteTargetBox}>
            <Text style={styles.deleteTargetText}>{confirmation.itemLabel}</Text>
            <Text style={styles.deleteTargetContext}>{confirmation.contextLabel}</Text>
          </View>
          <Text style={styles.message}>{confirmation.helper}</Text>
          {deleteState.error ? (
            <View
              ref={errorRef}
              accessible
              accessibilityLabel={`${deleteState.error.title}. ${deleteState.error.helper}`}
              accessibilityLiveRegion="assertive"
              style={styles.errorBox}
            >
              <Text style={styles.errorTitle}>{deleteState.error.title}</Text>
              <Text style={styles.message}>{deleteState.error.helper}</Text>
            </View>
          ) : null}
          <View style={styles.actionGroup}>
            <Pressable
              accessibilityRole="button"
              disabled={submitView.disabled}
              onPress={onConfirm}
              style={[styles.dangerButton, submitView.disabled ? styles.buttonDisabled : null]}
            >
              {isDeleting ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{submitView.label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isDeleting}
              onPress={onCancel}
              style={[styles.secondaryButton, isDeleting ? styles.secondaryButtonDisabled : null]}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
