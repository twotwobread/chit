import { ScrollView, Text, View } from 'react-native';

import { ActionRow, Badge, InlineAction, SecondaryButton } from '../design';
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
  highlighted = false,
  isSheetVisible,
  lodgingState,
  onCancelPicker,
  onClear,
  onCloseSheet,
  onCopyAddress,
  onOpenSearchRegister,
  onOpenSheet,
  onSummaryRef,
  onSelectPlace,
  pickerState,
  viewModel,
}: {
  highlighted?: boolean;
  isSheetVisible: boolean;
  lodgingState: DayItineraryLodgingState;
  pickerState: DayItineraryLodgingPickerState;
  viewModel: DayLodgingPanelViewModel;
  onCancelPicker: () => void;
  onClear: () => void;
  onCloseSheet: () => void;
  onCopyAddress: () => void;
  onOpenSearchRegister: () => void;
  onOpenSheet: () => void;
  onSummaryRef?: (node: View | null) => void;
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
      <View ref={onSummaryRef}>
        <ActionRow
          accessibilityLabel={`${viewModel.summary.label} ${viewModel.summary.placeName} ${viewModel.summary.actionLabel}`}
          meta={viewModel.summary.actionLabel}
          onPress={viewModel.sheet.placeName ? onOpenSheet : onOpenSearchRegister}
          selected={highlighted}
          subtitle={viewModel.summary.label}
          title={viewModel.summary.placeName}
        />
      </View>

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
                      <InlineAction
                        disabled={isBusy}
                        key={action.kind}
                        label={action.label}
                        onPress={onCopyAddress}
                        style={styles.lodgingCurrentActionButton}
                      />
                    ) : (
                      <InlineAction
                        disabled={isBusy}
                        key={action.kind}
                        label={lodgingState.status === 'clearing' ? dayLodgingCopy.clearing : action.label}
                        onPress={onClear}
                        style={styles.lodgingCurrentActionButton}
                        tone="danger"
                      />
                    ),
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          {managementActionRow ? (
            <View style={styles.lodgingSheetActions}>
              {managementActionRow.actions.map((action) => (
                <InlineAction
                  disabled={isBusy}
                  key={action.kind}
                  label={action.label}
                  onPress={onOpenSearchRegister}
                  style={styles.lodgingSheetActionButton}
                />
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
            <ActionRow
              disabled={isMutating || option.selected}
              key={option.id}
              onPress={() => onSelectPlace(option)}
              selected={option.selected}
              subtitle={option.address}
              title={option.name}
              trailing={option.selected ? <Badge label="선택됨" tone="primary" /> : null}
            />
          ))}
        </View>
      </ScrollView>
      <SecondaryButton disabled={isBusy} label="닫기" onPress={onCancelPicker} />
    </View>
  );
}
