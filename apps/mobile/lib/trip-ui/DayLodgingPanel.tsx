import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '../design';
import {
  buildDayLodgingManagementActionRows,
  buildDayLodgingManagementActions,
  buildDayLodgingPlaceOptionsPresentation,
  dayLodgingCopy,
  type DayLodgingPanelViewModel,
  type DayLodgingPlaceOptionViewModel,
} from '../trips/lodging-place';
import { BottomSheet } from './BottomSheet';
import { styles } from './DayItineraryEditorStyles';
import type { DayItineraryLodgingPickerState, DayItineraryLodgingState } from './DayItineraryEditorTypes';

export function DayLodgingPanel({
  isSheetVisible,
  lodgingState,
  onCancelPicker,
  onClear,
  onCloseSheet,
  onCopyAddress,
  onOpenSearchRegister,
  onOpenSelection,
  onOpenSheet,
  onSelectPlace,
  pickerState,
  viewModel,
}: {
  isSheetVisible: boolean;
  lodgingState: DayItineraryLodgingState;
  pickerState: DayItineraryLodgingPickerState;
  viewModel: DayLodgingPanelViewModel;
  onCancelPicker: () => void;
  onClear: () => void;
  onCloseSheet: () => void;
  onCopyAddress: () => void;
  onOpenSearchRegister: () => void;
  onOpenSelection: () => void;
  onOpenSheet: () => void;
  onSelectPlace: (option: DayLodgingPlaceOptionViewModel) => void;
}) {
  const isMutating = lodgingState.status === 'setting' || lodgingState.status === 'clearing';
  const isBusy = isMutating;
  const managementActionRows = buildDayLodgingManagementActionRows(buildDayLodgingManagementActions(viewModel.sheet));
  const currentPlaceActionRow = managementActionRows.find((row) => row.id === 'current-place-actions');
  const managementActionRow = managementActionRows.find((row) => row.id === 'management-actions');

  const closeSheet = () => {
    if (isBusy) {
      return;
    }
    if (pickerState.status !== 'idle') {
      onCancelPicker();
    }
    onCloseSheet();
  };

  return (
    <>
      <Pressable accessibilityRole="button" onPress={onOpenSheet} style={styles.lodgingSummary}>
        <View style={styles.lodgingSummaryTextGroup}>
          <Text style={styles.lodgingSummaryLabel}>{viewModel.summary.label}</Text>
          <Text numberOfLines={1} style={styles.lodgingSummaryName}>
            {viewModel.summary.placeName}
          </Text>
        </View>
        <Text style={styles.lodgingSummaryAction}>{viewModel.summary.actionLabel}</Text>
      </Pressable>

      <BottomSheet onClose={closeSheet} visible={isSheetVisible}>
        <ScrollView contentContainerStyle={styles.lodgingSheetBody} showsVerticalScrollIndicator={false}>
          <View style={styles.lodgingSheetHeader}>
            <Text style={styles.lodgingSheetTitle}>{viewModel.sheet.title}</Text>
            {viewModel.sheet.helper ? <Text style={styles.message}>{viewModel.sheet.helper}</Text> : null}
          </View>

          {viewModel.sheet.placeName ? (
            <View style={styles.lodgingCurrentBox}>
              <View style={styles.placeTitleRow}>
                <Text style={styles.lodgingPlaceName}>{viewModel.sheet.placeName}</Text>
                <Badge label={dayLodgingCopy.badge} tone="primary" />
              </View>
              {viewModel.sheet.address ? <Text style={styles.address}>{viewModel.sheet.address}</Text> : null}
              {currentPlaceActionRow ? (
                <View style={styles.lodgingCurrentActionRow}>
                  {currentPlaceActionRow.actions.map((action) =>
                    action.kind === 'copyAddress' ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        key={action.kind}
                        onPress={onCopyAddress}
                        style={[
                          styles.rowActionButton,
                          styles.lodgingCurrentActionButton,
                          isBusy ? styles.rowActionButtonDisabled : null,
                        ]}
                      >
                        <Text style={styles.rowActionText}>{action.label}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isBusy}
                        key={action.kind}
                        onPress={onClear}
                        style={[
                          styles.rowDangerActionButton,
                          styles.lodgingCurrentActionButton,
                          isBusy ? styles.rowActionButtonDisabled : null,
                        ]}
                      >
                        <Text style={styles.rowDangerActionText}>
                          {lodgingState.status === 'clearing' ? dayLodgingCopy.clearing : action.label}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {managementActionRow ? (
            <View style={styles.lodgingSheetActions}>
              {managementActionRow.actions.map((action) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  key={action.kind}
                  onPress={action.kind === 'change' ? onOpenSelection : onOpenSearchRegister}
                  style={[
                    styles.secondaryButton,
                    styles.lodgingSheetActionButton,
                    isBusy ? styles.secondaryButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {pickerState.status === 'loading' ? <Text style={styles.message}>{dayLodgingCopy.loadingPlaces}</Text> : null}

          {pickerState.status === 'selecting' ? (
            <ExistingPlaceOptions
              isBusy={isBusy}
              isMutating={isMutating}
              onCancelPicker={onCancelPicker}
              onSelectPlace={onSelectPlace}
              options={pickerState.options}
            />
          ) : null}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

function ExistingPlaceOptions({
  isBusy,
  isMutating,
  onCancelPicker,
  onSelectPlace,
  options,
}: {
  isBusy: boolean;
  isMutating: boolean;
  options: DayLodgingPlaceOptionViewModel[];
  onCancelPicker: () => void;
  onSelectPlace: (option: DayLodgingPlaceOptionViewModel) => void;
}) {
  const presentation = buildDayLodgingPlaceOptionsPresentation(options);

  return (
    <View style={styles.lodgingPickerBox}>
      {options.length === 0 ? <Text style={styles.message}>{dayLodgingCopy.emptyPlaces}</Text> : null}
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={presentation.isScrollable}
        style={presentation.isScrollable ? styles.lodgingOptionListScrollable : null}
      >
        <View style={styles.lodgingOptionListContent}>
          {options.map((option) => (
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
        </View>
      </ScrollView>
      <Pressable accessibilityRole="button" disabled={isBusy} onPress={onCancelPicker} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>닫기</Text>
      </Pressable>
    </View>
  );
}
