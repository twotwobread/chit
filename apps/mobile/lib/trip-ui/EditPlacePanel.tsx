import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { type TripPlaceType } from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import { type DayItineraryRowViewModel } from '../trips/day-itinerary';
import { buildDayItineraryEditSubmitState, type DayItineraryEditFormValues } from '../trips/day-itinerary-edit';
import { type DayItineraryMapActionFeedback } from '../trips/day-itinerary-map-actions';
import { manualPlaceTypeOptions } from '../trips/manual-place';
import { styles } from './DayItineraryEditorStyles';
import type { EditPlacePanelState } from './DayItineraryEditorTypes';
import { ScheduleTimeEditor } from './ScheduleTimeEditor';

type EditPlacePanelVariant = 'card' | 'sheet';

export function EditPlacePanel({
  editState,
  mapActionFeedback,
  onCancel,
  onCopyAddress,
  onOpenMap,
  onSubmit,
  onUpdateValues,
  variant = 'card',
}: {
  editState: EditPlacePanelState;
  mapActionFeedback?: DayItineraryMapActionFeedback | null;
  onCancel: () => void;
  onCopyAddress?: (item: DayItineraryRowViewModel) => void;
  onOpenMap?: (item: DayItineraryRowViewModel) => void;
  onSubmit: () => void;
  onUpdateValues: (values: DayItineraryEditFormValues) => void;
  variant?: EditPlacePanelVariant;
}) {
  const isSaving = editState.status === 'saving';
  const submitView = buildDayItineraryEditSubmitState(isSaving);
  const update = (patch: Partial<DayItineraryEditFormValues>) => onUpdateValues({ ...editState.values, ...patch });
  const currentItem: DayItineraryRowViewModel = {
    ...editState.item,
    address: editState.values.address,
    placeName: editState.values.name,
  };

  const content = (
    <>
      <Text style={styles.panelTitle}>장소 수정</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소명</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(name) => update({ name })}
          placeholder="예: 우메다 공중정원"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editState.values.name}
        />
        {editState.errors.name ? <Text style={styles.fieldError}>{editState.errors.name}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactChipList}>
          {manualPlaceTypeOptions.map((option) => {
            const selected = editState.values.placeType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => update({ placeType: option.value as TripPlaceType })}
                style={[styles.chip, styles.chipCompact, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {editState.errors.placeType ? <Text style={styles.fieldError}>{editState.errors.placeType}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>주소</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(address) => update({ address })}
          placeholder="예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editState.values.address}
        />
        {editState.errors.address ? <Text style={styles.fieldError}>{editState.errors.address}</Text> : null}
        {onCopyAddress || onOpenMap ? (
          <View style={styles.detailActionGroup}>
            {onCopyAddress ? (
              <Pressable
                accessibilityLabel={`${editState.values.name} 주소 복사`}
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => onCopyAddress(currentItem)}
                style={({ pressed }) => [styles.rowActionButton, pressed ? styles.rowActionButtonPressed : null]}
              >
                <Text style={styles.rowActionText}>주소 복사</Text>
              </Pressable>
            ) : null}
            {onOpenMap ? (
              <Pressable
                accessibilityLabel={`${editState.values.name} 지도에서 보기`}
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => onOpenMap(currentItem)}
                style={({ pressed }) => [styles.rowActionButton, pressed ? styles.rowActionButtonPressed : null]}
              >
                <Text style={styles.rowActionText}>지도에서 보기</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {mapActionFeedback ? (
          <View style={mapActionFeedback.kind === 'error' ? styles.errorBox : styles.inlineSuccessNotice}>
            <Text style={styles.message}>{mapActionFeedback.message}</Text>
          </View>
        ) : null}
      </View>

      <ScheduleTimeEditor
        disabled={isSaving}
        endTimeError={editState.errors.endTime}
        onChange={update}
        startTimeError={editState.errors.startTime}
        values={editState.values}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(memo) => update({ memo })}
          placeholder="선택 입력"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editState.values.memo}
        />
        {editState.errors.memo ? <Text style={styles.fieldError}>{editState.errors.memo}</Text> : null}
      </View>

      {editState.errors.form ? <Text style={styles.fieldError}>{editState.errors.form}</Text> : null}

      {editState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editState.error.title}</Text>
          <Text style={styles.message}>{editState.error.helper}</Text>
        </View>
      ) : null}

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
    </>
  );

  return variant === 'sheet' ? <View style={styles.sheetFormBody}>{content}</View> : <Card>{content}</Card>;
}
