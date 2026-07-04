import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { type TripPlaceType } from '@i-um/api-contract';

import { theme } from '../design';
import { buildDayItineraryEditSubmitState, type DayItineraryEditFormValues } from '../trips/day-itinerary-edit';
import { manualPlaceTypeOptions } from '../trips/manual-place';
import { styles } from './DayItineraryEditorStyles';
import type { EditPlacePanelState } from './DayItineraryEditorTypes';

export function EditPlacePanel({
  editState,
  onCancel,
  onSubmit,
  onUpdateValues,
}: {
  editState: EditPlacePanelState;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: DayItineraryEditFormValues) => void;
}) {
  const isSaving = editState.status === 'saving';
  const submitView = buildDayItineraryEditSubmitState(isSaving);

  return (
    <View style={styles.card}>
      <Text style={styles.panelTitle}>장소 수정</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소명</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(name) => onUpdateValues({ ...editState.values, name })}
          placeholder="예: 우메다 공중정원"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editState.values.name}
        />
        {editState.errors.name ? <Text style={styles.fieldError}>{editState.errors.name}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>주소</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(address) => onUpdateValues({ ...editState.values, address })}
          placeholder="예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editState.values.address}
        />
        {editState.errors.address ? <Text style={styles.fieldError}>{editState.errors.address}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>시간</Text>
        <View style={styles.timeFieldRow}>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="시작 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(startTime) => onUpdateValues({ ...editState.values, startTime })}
              placeholder="시작 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editState.values.startTime}
            />
            {editState.errors.startTime ? <Text style={styles.fieldError}>{editState.errors.startTime}</Text> : null}
          </View>
          <View style={styles.timeField}>
            <TextInput
              accessibilityLabel="종료 시간"
              editable={!isSaving}
              keyboardType="numbers-and-punctuation"
              onChangeText={(endTime) => onUpdateValues({ ...editState.values, endTime })}
              placeholder="종료 HH:mm"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editState.values.endTime}
            />
            {editState.errors.endTime ? <Text style={styles.fieldError}>{editState.errors.endTime}</Text> : null}
          </View>
        </View>
        <Text style={styles.fieldHelper}>비워두면 순서만 있는 일정으로 유지돼요.</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소 타입</Text>
        <View style={styles.chipList}>
          {manualPlaceTypeOptions.map((option) => {
            const selected = editState.values.placeType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => onUpdateValues({ ...editState.values, placeType: option.value as TripPlaceType })}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {editState.errors.placeType ? <Text style={styles.fieldError}>{editState.errors.placeType}</Text> : null}
        {editState.errors.form ? <Text style={styles.fieldError}>{editState.errors.form}</Text> : null}
      </View>

      {editState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editState.error.title}</Text>
          <Text style={styles.message}>{editState.error.helper}</Text>
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={submitView.disabled}
          onPress={onSubmit}
          style={[styles.button, submitView.disabled ? styles.buttonDisabled : null]}
        >
          {isSaving ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{submitView.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}
