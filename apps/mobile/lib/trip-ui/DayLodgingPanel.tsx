import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { Badge, theme } from '../design';
import {
  buildManualDayLodgingPlaceSubmitState,
  dayLodgingCopy,
  type DayLodgingManualFormValues,
  type DayLodgingPanelViewModel,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { styles } from './DayItineraryEditorStyles';
import type { DayItineraryLodgingPickerState, DayItineraryLodgingState } from './DayItineraryEditorTypes';

export function DayLodgingPanel({
  lodgingState,
  onCancelPicker,
  onClear,
  onCreateManual,
  onOpenManual,
  onOpenSelection,
  onSelectPlace,
  onUpdateManualValues,
  pickerState,
  viewModel,
}: {
  lodgingState: DayItineraryLodgingState;
  pickerState: DayItineraryLodgingPickerState;
  viewModel: DayLodgingPanelViewModel;
  onCancelPicker: () => void;
  onClear: () => void;
  onCreateManual: () => void;
  onOpenManual: () => void;
  onOpenSelection: () => void;
  onSelectPlace: (option: DayLodgingPlaceOptionViewModel) => void;
  onUpdateManualValues: (values: DayLodgingManualFormValues) => void;
}) {
  const isMutating = lodgingState.status === 'setting' || lodgingState.status === 'clearing';
  const isCreating = pickerState.status === 'creating';
  const manualSubmit = buildManualDayLodgingPlaceSubmitState(isCreating);

  return (
    <View style={styles.lodgingBox}>
      <View style={styles.placeTitleRow}>
        <Text style={styles.placeName}>{viewModel.label}</Text>
        {viewModel.canClear ? <Badge label={dayLodgingCopy.badge} tone="primary" /> : null}
      </View>
      {viewModel.placeName ? <Text style={styles.lodgingPlaceName}>{viewModel.placeName}</Text> : null}
      {viewModel.address ? <Text style={styles.address}>{viewModel.address}</Text> : null}
      {viewModel.helper ? <Text style={styles.message}>{viewModel.helper}</Text> : null}

      <View style={styles.rowActionGroup}>
        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={onOpenSelection}
          style={styles.rowActionButton}
        >
          <Text style={styles.rowActionText}>{dayLodgingCopy.selectExistingAction}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isMutating}
          onPress={onOpenManual}
          style={styles.rowActionButton}
        >
          <Text style={styles.rowActionText}>{dayLodgingCopy.manualRegisterAction}</Text>
        </Pressable>
        {viewModel.canClear ? (
          <Pressable
            accessibilityRole="button"
            disabled={isMutating}
            onPress={onClear}
            style={[styles.rowDangerActionButton, isMutating ? styles.rowActionButtonDisabled : null]}
          >
            <Text style={styles.rowDangerActionText}>
              {lodgingState.status === 'clearing' ? dayLodgingCopy.clearing : dayLodgingCopy.clearAction}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {pickerState.status === 'loading' ? <Text style={styles.message}>{dayLodgingCopy.loadingPlaces}</Text> : null}

      {pickerState.status === 'selecting' ? (
        <View style={styles.lodgingPickerBox}>
          {pickerState.options.length === 0 ? <Text style={styles.message}>{dayLodgingCopy.emptyPlaces}</Text> : null}
          {pickerState.options.map((option) => (
            <Pressable
              accessibilityRole="button"
              disabled={isMutating || option.selected}
              key={option.id}
              onPress={() => onSelectPlace(option)}
              style={[styles.lodgingOption, option.selected ? styles.lodgingOptionSelected : null]}
            >
              <View style={styles.placeTitleRow}>
                <Text style={styles.placeName}>{option.name}</Text>
                {option.selected ? <Badge label="선택됨" tone="primary" /> : null}
              </View>
              <Text style={styles.address}>{option.address}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onCancelPicker} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>닫기</Text>
          </Pressable>
        </View>
      ) : null}

      {pickerState.status === 'manual' || pickerState.status === 'creating' ? (
        <View style={styles.lodgingPickerBox}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>숙소명</Text>
            <TextInput
              editable={!isCreating}
              onChangeText={(name) => onUpdateManualValues({ ...pickerState.values, name })}
              placeholder="예: 호텔 니코 오사카"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={pickerState.values.name}
            />
            {pickerState.errors.name ? <Text style={styles.fieldError}>{pickerState.errors.name}</Text> : null}
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>주소</Text>
            <TextInput
              editable={!isCreating}
              multiline
              onChangeText={(address) => onUpdateManualValues({ ...pickerState.values, address })}
              placeholder="예: Nishi-Shinsaibashi"
              placeholderTextColor={theme.color.textFaint}
              style={[styles.input, styles.addressInput]}
              textAlignVertical="top"
              value={pickerState.values.address}
            />
            {pickerState.errors.address ? <Text style={styles.fieldError}>{pickerState.errors.address}</Text> : null}
            {pickerState.errors.form ? <Text style={styles.fieldError}>{pickerState.errors.form}</Text> : null}
          </View>
          <View style={styles.rowActionGroup}>
            <Pressable
              accessibilityRole="button"
              disabled={manualSubmit.disabled}
              onPress={onCreateManual}
              style={[styles.button, manualSubmit.disabled ? styles.buttonDisabled : null]}
            >
              {isCreating ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{manualSubmit.label}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isCreating}
              onPress={onCancelPicker}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
