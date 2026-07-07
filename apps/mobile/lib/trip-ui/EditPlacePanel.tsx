import { Pressable, Text, TextInput, View } from 'react-native';

import { type TripPlaceType } from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import { buildDayItineraryEditSubmitState, type DayItineraryEditFormValues } from '../trips/day-itinerary-edit';
import { manualPlaceTypeOptions } from '../trips/manual-place';
import { styles } from './DayItineraryEditorStyles';
import type { EditPlacePanelState } from './DayItineraryEditorTypes';
import { ScheduleTimeEditor } from './ScheduleTimeEditor';

const editPlaceTimeHelper =
  '비워두면 순서만 있는 일정으로 유지돼요. 시간을 바꿔도 순서는 자동으로 바뀌지 않아요. 필요하면 순서 변경으로 조정해주세요.';

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
    <Card>
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

      <ScheduleTimeEditor
        disabled={isSaving}
        emptyHelper="시간을 정하지 않으면 시간 미정 일정으로 유지돼요."
        endTimeError={editState.errors.endTime}
        helper={editPlaceTimeHelper}
        onChange={(patch) => onUpdateValues({ ...editState.values, ...patch })}
        startTimeError={editState.errors.startTime}
        values={editState.values}
      />

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
        <PrimaryButton
          disabled={submitView.disabled}
          label={submitView.label}
          loading={isSaving}
          loadingLabel={submitView.label}
          onPress={onSubmit}
        />
        <SecondaryButton disabled={isSaving} label="취소" onPress={onCancel} />
      </View>
    </Card>
  );
}
