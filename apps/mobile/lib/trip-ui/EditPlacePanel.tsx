import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, FormField, PrimaryButton, SecondaryButton, TextInputField } from '../design';
import {
  buildDayItineraryEditPlaceSummary,
  buildDayItineraryEditSubmitState,
  type DayItineraryEditFormValues,
} from '../trips/day-itinerary-edit';
import { manualPlaceTypeOptions } from '../trips/manual-place';
import { styles } from './DayItineraryEditorStyles';
import type { EditPlacePanelState } from './DayItineraryEditorTypes';
import { ScheduleTimeEditor } from './ScheduleTimeEditor';

type EditPlacePanelVariant = 'card' | 'sheet';

export function EditPlacePanel({
  editState,
  onCancel,
  onSubmit,
  onUpdateValues,
  showActions = true,
  variant = 'card',
}: {
  editState: EditPlacePanelState;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: DayItineraryEditFormValues) => void;
  showActions?: boolean;
  variant?: EditPlacePanelVariant;
}) {
  const isSaving = editState.status === 'saving';
  const submitView = buildDayItineraryEditSubmitState(isSaving);
  const placeSummary = buildDayItineraryEditPlaceSummary(editState.item);
  const update = (patch: Partial<DayItineraryEditFormValues>) => onUpdateValues({ ...editState.values, ...patch });

  const content = (
    <>
      <Text style={styles.panelTitle}>일정 상세 · 수정</Text>
      <View style={styles.detailAddressBox}>
        <FormField label="장소명">
          <Text style={styles.detailAddressText}>{placeSummary.placeName}</Text>
        </FormField>
        {placeSummary.address ? (
          <FormField label="주소">
            <Text style={styles.detailAddressText}>{placeSummary.address}</Text>
          </FormField>
        ) : null}
      </View>

      <FormField disabled={isSaving} errorText={editState.errors.placeType ?? undefined} label="장소 타입" required>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactChipList}>
          {manualPlaceTypeOptions.map((option) => {
            const selected = editState.values.placeType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={isSaving}
                key={option.value}
                onPress={() => update({ placeType: option.value })}
                style={[styles.chip, styles.chipCompact, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </FormField>

      <ScheduleTimeEditor
        defaultStartTime={editState.defaultStartTime ?? undefined}
        disabled={isSaving}
        endTimeError={editState.errors.endTime}
        onChange={update}
        startTimeError={editState.errors.startTime}
        values={editState.values}
      />

      <TextInputField
        disabled={isSaving}
        errorText={editState.errors.memo ?? undefined}
        inputStyle={styles.addressInput}
        label="메모"
        multiline
        onChangeText={(memo) => update({ memo })}
        placeholder="선택 입력"
        value={editState.values.memo}
      />

      {editState.errors.form ? <Text style={styles.fieldError}>{editState.errors.form}</Text> : null}

      {editState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editState.error.title}</Text>
          <Text style={styles.message}>{editState.error.helper}</Text>
        </View>
      ) : null}

      {showActions ? (
        <View style={variant === 'sheet' ? styles.sheetActionRow : styles.actionGroup}>
          <SecondaryButton
            disabled={isSaving}
            label="취소"
            onPress={onCancel}
            style={variant === 'sheet' ? styles.sheetActionButton : null}
          />
          <PrimaryButton
            disabled={submitView.disabled}
            label={submitView.label}
            loading={isSaving}
            loadingLabel={submitView.label}
            onPress={onSubmit}
            style={variant === 'sheet' ? styles.sheetActionButton : null}
          />
        </View>
      ) : null}
    </>
  );

  return variant === 'sheet' ? <View style={styles.sheetFormBody}>{content}</View> : <Card>{content}</Card>;
}
