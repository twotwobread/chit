import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { type SupportedCurrency } from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import { dateFromString, isValidDate, monthStringFromDate } from '../trips/date';
import { TripDateFieldButton, TripDatePicker } from '../trips/date-picker';
import {
  buildCreateQuickExpenseRequest,
  buildCreateTripExpenseRequest,
  buildQuickExpenseManualSplitSummary,
  formatMoney,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseSplitPolicy,
  type QuickExpenseViewModel,
} from '../trips/quick-expense';
import { DayChips } from './DayChips';
import { styles } from './QuickExpenseEntryStyles';

export function QuickExpenseForm({
  amountInput,
  errors,
  expenseDateInput,
  formMessage,
  mode,
  onBack,
  onClearTripDay,
  onSelectItem,
  onSelectPayer,
  onSelectSplitPolicy,
  onSelectTripDay,
  onSubmit,
  onToggleSplitParticipant,
  onUpdateAmount,
  onUpdateExpenseDate,
  onUpdateMemo,
  onUpdateManualSplitInput,
  onUpdateTitle,
  payerParticipantId,
  saving,
  selectedItemId,
  selectedSplitParticipantIds,
  splitPolicy,
  manualSplitInputs,
  memoInput,
  titleInput,
  tripName,
  viewModel,
}: {
  amountInput: string;
  errors: QuickExpenseFormErrors;
  expenseDateInput: string;
  formMessage: string | null;
  mode: 'today' | 'settlement';
  onBack: () => void;
  onClearTripDay: () => void;
  onSelectItem: (itemId: string) => void;
  onSelectPayer: (participantId: string) => void;
  onSelectSplitPolicy: (
    policy: QuickExpenseSplitPolicy,
    previewRows: QuickExpenseViewModel['splitPreviewRows'],
  ) => void;
  onSelectTripDay: (tripDayId: string) => void;
  onSubmit: () => void;
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateAmount: (value: string) => void;
  onUpdateExpenseDate: (value: string) => void;
  onUpdateMemo: (value: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  onUpdateTitle: (value: string) => void;
  payerParticipantId: string | null;
  saving: boolean;
  selectedItemId: string | null;
  selectedSplitParticipantIds: string[];
  splitPolicy: QuickExpenseSplitPolicy;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  memoInput: string;
  titleInput: string;
  tripName: string;
  viewModel: QuickExpenseViewModel;
}) {
  const activeManualSplitInputs = manualSplitInputs.filter((input) =>
    selectedSplitParticipantIds.includes(input.participantId),
  );
  const validation =
    mode === 'settlement'
      ? buildCreateTripExpenseRequest({
          titleInput,
          expenseDate: expenseDateInput,
          amountInput,
          currency: viewModel.currency,
          selectedTripDayId: viewModel.selectedTripDayId,
          scheduleItemId: selectedItemId,
          splitPolicy,
          participantIds: selectedSplitParticipantIds,
          manualSplitInputs: activeManualSplitInputs,
          payerParticipantId,
          memoInput,
        })
      : buildCreateQuickExpenseRequest({
          amountInput,
          currency: viewModel.currency,
          scheduleItemId: selectedItemId,
          splitPolicy,
          participantIds: selectedSplitParticipantIds,
          manualSplitInputs: activeManualSplitInputs,
          payerParticipantId,
        });
  const canSubmit = validation.ok && !saving && !viewModel.emptyMessage;
  const selectedPayerOptions = viewModel.payerOptions.map((option) => ({
    ...option,
    selected: option.participantId === payerParticipantId,
  }));
  const [itemSelectorExpanded, setItemSelectorExpanded] = useState(false);
  const [paymentDatePickerOpen, setPaymentDatePickerOpen] = useState(false);
  const [paymentCalendarMonth, setPaymentCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const selectItem = (itemId: string) => {
    onSelectItem(itemId);
    setItemSelectorExpanded(false);
  };
  const showDayContext = viewModel.dayLabel === '전체 일정';
  const showDayTabs = mode === 'settlement' ? viewModel.dayOptions.length > 0 : viewModel.dayOptions.length > 1;
  const showAllScheduleContext = showDayContext && viewModel.selectedTripDayId === null;
  const selectedItemTitle = viewModel.selectedItem
    ? `${showDayContext ? `${viewModel.selectedItem.dayLabel} · ` : ''}${viewModel.selectedItem.placeName}`
    : mode === 'settlement'
      ? '일정 선택 안 함'
      : '일정을 선택해주세요.';
  const selectTripDay = (tripDayId: string) => {
    onSelectTripDay(tripDayId);
    setItemSelectorExpanded(false);
  };
  const openPaymentDatePicker = () => {
    setPaymentCalendarMonth(
      monthStringFromDate(isValidDate(expenseDateInput) ? dateFromString(expenseDateInput) : new Date()),
    );
    setPaymentDatePickerOpen(true);
  };
  const selectPaymentDate = (date: string) => {
    onUpdateExpenseDate(date);
    setPaymentDatePickerOpen(false);
  };

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.tripName}>{tripName}</Text>
        <Text style={styles.dayText}>
          {viewModel.dayLabel} · {viewModel.formattedDate}
        </Text>
      </View>

      {viewModel.emptyMessage ? (
        <View style={styles.noticeBox}>
          <Text style={styles.message}>{viewModel.emptyMessage}</Text>
        </View>
      ) : null}

      {viewModel.helper ? <Text style={styles.helper}>{viewModel.helper}</Text> : null}

      {mode === 'settlement' ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>지출명</Text>
            <TextInput
              accessibilityLabel="지출명"
              editable={!saving}
              onChangeText={onUpdateTitle}
              placeholder={selectedItemId ? '선택 입력' : '예: 항공권, 숙소 예약금'}
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={titleInput}
            />
            {errors.title ? <Text style={styles.errorMessage}>{errors.title}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>결제일자</Text>
            <TripDateFieldButton
              disabled={saving}
              onPress={openPaymentDatePicker}
              placeholder="결제일자 선택"
              value={expenseDateInput}
            />
            {paymentDatePickerOpen ? (
              <TripDatePicker
                helperText="실제 결제된 날짜를 선택해주세요. 여행 기간 밖 날짜도 선택할 수 있어요."
                label="결제일자"
                month={paymentCalendarMonth}
                onClose={() => setPaymentDatePickerOpen(false)}
                onMonthChange={setPaymentCalendarMonth}
                onSelect={selectPaymentDate}
                selectedDate={expenseDateInput}
              />
            ) : null}
            {errors.expenseDate ? <Text style={styles.errorMessage}>{errors.expenseDate}</Text> : null}
          </View>
        </>
      ) : null}

      {showDayTabs ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{mode === 'settlement' ? '관련 여행일' : '일차 선택'}</Text>
          {mode === 'settlement' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: viewModel.selectedTripDayId === null }}
              disabled={saving}
              onPress={onClearTripDay}
              style={[styles.payerChip, viewModel.selectedTripDayId === null ? styles.optionCardSelected : null]}
            >
              <Text style={viewModel.selectedTripDayId === null ? styles.payerChipTextSelected : styles.payerChipText}>
                선택 안 함
              </Text>
            </Pressable>
          ) : null}
          <DayChips
            days={viewModel.dayOptions.map((option) => ({
              id: option.tripDayId,
              label: option.dayLabel,
              statusLabel: `일정 ${option.itemCount}개`,
            }))}
            edgePadding={0}
            onSelectDay={selectTripDay}
            selectedDayId={viewModel.selectedTripDayId}
          />
        </View>
      ) : null}

      {viewModel.showItemSelector && viewModel.itemOptions.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{mode === 'settlement' ? '관련 일정' : '연결할 일정'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: itemSelectorExpanded }}
            onPress={() => setItemSelectorExpanded((expanded) => !expanded)}
            style={({ pressed }) => [
              styles.scheduleSelectorButton,
              viewModel.selectedItem ? null : styles.scheduleSelectorButtonEmpty,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.scheduleSelectorTextColumn}>
              <Text style={styles.optionTitle}>{selectedItemTitle}</Text>
              {viewModel.selectedItem?.timeLabel ? (
                <Text style={styles.timeLabel}>{viewModel.selectedItem.timeLabel}</Text>
              ) : null}
              {viewModel.selectedItem?.address ? (
                <Text numberOfLines={1} style={styles.address}>
                  {viewModel.selectedItem.address}
                </Text>
              ) : null}
            </View>
            <Text style={styles.scheduleSelectorAction}>{itemSelectorExpanded ? '닫기' : '변경'}</Text>
          </Pressable>
          {itemSelectorExpanded ? (
            <View style={styles.scheduleSelectorMenu}>
              {viewModel.itemOptions.map((option) => {
                const selected = option.itemId === selectedItemId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={option.itemId}
                    onPress={() => selectItem(option.itemId)}
                    style={({ pressed }) => [
                      styles.optionCard,
                      selected ? styles.optionCardSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View style={styles.placeMetaRow}>
                      {showAllScheduleContext ? (
                        <Text style={styles.dayBadge}>
                          {option.dayLabel} · {option.formattedDate}
                        </Text>
                      ) : null}
                      <Text style={styles.orderBadge}>{option.orderLabel}</Text>
                      <Text style={styles.placeType}>{option.placeTypeLabel}</Text>
                    </View>
                    <Text style={styles.optionTitle}>{option.placeName}</Text>
                    {option.timeLabel ? <Text style={styles.timeLabel}>{option.timeLabel}</Text> : null}
                    {option.address ? <Text style={styles.address}>{option.address}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {errors.item ? <Text style={styles.errorMessage}>{errors.item}</Text> : null}
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>금액</Text>
        <View style={styles.amountInputBox}>
          <TextInput
            accessibilityLabel="금액"
            editable={!saving && !viewModel.emptyMessage}
            keyboardType={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
            onChangeText={onUpdateAmount}
            placeholder={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? '18500' : '12.34'}
            placeholderTextColor={theme.color.textFaint}
            style={styles.amountInput}
            value={amountInput}
          />
          <Text style={styles.currencyLabel}>{viewModel.currencyLabel}</Text>
        </View>
        {errors.amount ? <Text style={styles.errorMessage}>{errors.amount}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>결제자</Text>
        <View style={styles.optionList}>
          {selectedPayerOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.selected }}
              disabled={saving || Boolean(viewModel.emptyMessage)}
              key={option.participantId}
              onPress={() => onSelectPayer(option.participantId)}
              style={[styles.payerChip, option.selected ? styles.optionCardSelected : null]}
            >
              <Text style={option.selected ? styles.payerChipTextSelected : styles.payerChipText}>
                {option.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.payer ? <Text style={styles.errorMessage}>{errors.payer}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분할 방식</Text>
        <View style={styles.modeRow}>
          {(['equal', 'manual'] as const).map((policy) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: splitPolicy === policy }}
              disabled={saving || Boolean(viewModel.emptyMessage)}
              key={policy}
              onPress={() => onSelectSplitPolicy(policy, viewModel.splitPreviewRows)}
              style={[styles.modeChip, splitPolicy === policy ? styles.optionCardSelected : null]}
            >
              <Text style={splitPolicy === policy ? styles.payerChipTextSelected : styles.payerChipText}>
                {policy === 'equal' ? '1/N 분할' : '직접 분할'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {splitPolicy === 'equal' ? (
        <>
          <View style={styles.fieldGroup}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>분할 대상</Text>
              <Text style={styles.splitHelper}>
                체크한 사람에게만 아래 금액으로 나눠져요. 결제자도 제외할 수 있어요.
              </Text>
            </View>
            <View style={styles.optionList}>
              {viewModel.splitParticipantOptions.map((option) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: option.selected }}
                  disabled={saving || Boolean(viewModel.emptyMessage)}
                  key={option.participantId}
                  onPress={() => onToggleSplitParticipant(option.participantId)}
                  style={[styles.payerChip, option.selected ? styles.optionCardSelected : null]}
                >
                  <Text style={option.selected ? styles.payerChipTextSelected : styles.payerChipText}>
                    {option.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.participants || viewModel.splitParticipantError ? (
              <Text style={styles.errorMessage}>{errors.participants ?? viewModel.splitParticipantError}</Text>
            ) : null}
          </View>

          {viewModel.splitPreviewRows.length > 0 ? (
            <SplitRowsSection
              helper="저장하면 선택한 참여자에게 아래 금액으로 나눠져요."
              rows={viewModel.splitPreviewRows}
              title="1/N 분할"
            />
          ) : null}
        </>
      ) : (
        <ManualSplitSection
          amountInput={amountInput}
          currency={viewModel.currency}
          disabled={saving || Boolean(viewModel.emptyMessage)}
          errorMessage={errors.participants ?? null}
          manualSplitInputs={manualSplitInputs}
          onToggleSplitParticipant={onToggleSplitParticipant}
          onUpdateManualSplitInput={onUpdateManualSplitInput}
          participants={viewModel.splitParticipantOptions}
        />
      )}

      {viewModel.splitPreviewMessage ? <Text style={styles.errorMessage}>{viewModel.splitPreviewMessage}</Text> : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!saving && !viewModel.emptyMessage}
          multiline
          onChangeText={onUpdateMemo}
          placeholder="선택 입력"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.memoInput]}
          textAlignVertical="top"
          value={memoInput}
        />
      </View>

      {formMessage ? <Text style={styles.errorMessage}>{formMessage}</Text> : null}

      <PrimaryButton
        disabled={!canSubmit}
        label="저장하기"
        loading={saving}
        loadingLabel="저장 중..."
        onPress={onSubmit}
      />
      <SecondaryButton disabled={saving} label="돌아가기" onPress={onBack} />
    </Card>
  );
}

export function QuickExpenseSavedSummaryCard({
  onDone,
  summary,
}: {
  onDone: () => void;
  summary: QuickExpenseSavedSplitSummary;
}) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.successTitle}>지출을 저장했어요.</Text>
        <Text style={styles.message}>총 {summary.amountLabel}</Text>
      </View>
      <SplitRowsSection helper="서버에 저장된 결과 기준이에요." rows={summary.splitRows} title="실제 저장된 분할" />
      <PrimaryButton label="확인" onPress={onDone} />
    </Card>
  );
}

function ManualSplitSection({
  amountInput,
  currency,
  disabled,
  errorMessage,
  manualSplitInputs,
  onToggleSplitParticipant,
  onUpdateManualSplitInput,
  participants,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  disabled: boolean;
  errorMessage: string | null;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  participants: QuickExpenseViewModel['splitParticipantOptions'];
}) {
  const selectedParticipants = participants.filter((participant) => participant.selected);
  const activeManualSplitInputs = manualSplitInputs.filter((input) =>
    selectedParticipants.some((participant) => participant.participantId === input.participantId),
  );
  const summary = buildQuickExpenseManualSplitSummary({
    amountInput,
    currency,
    manualSplitInputs: activeManualSplitInputs,
  });
  const inputByParticipantId = new Map(manualSplitInputs.map((split) => [split.participantId, split.amountInput]));
  const differenceLabel = manualSplitDifferenceLabel(summary.differenceMinor, currency);
  return (
    <View style={styles.splitSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>직접 분할</Text>
        <Text style={styles.splitHelper}>분할할 참여자를 선택하고 각 부담 금액을 입력해주세요.</Text>
      </View>
      <View style={styles.optionList}>
        {participants.map((participant) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: participant.selected }}
            disabled={disabled}
            key={participant.participantId}
            onPress={() => onToggleSplitParticipant(participant.participantId)}
            style={[styles.payerChip, participant.selected ? styles.optionCardSelected : null]}
          >
            <Text style={participant.selected ? styles.payerChipTextSelected : styles.payerChipText}>
              {participant.displayName}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.splitRowList}>
        {selectedParticipants.map((participant) => (
          <View key={participant.participantId} style={styles.manualSplitRow}>
            <Text style={styles.splitName}>{participant.displayName}</Text>
            <TextInput
              accessibilityLabel={`${participant.displayName} 부담 금액`}
              editable={!disabled}
              keyboardType={currency === 'KRW' || currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
              onChangeText={(value) => onUpdateManualSplitInput(participant.participantId, value)}
              placeholder="0"
              placeholderTextColor={theme.color.textFaint}
              style={styles.manualSplitInput}
              value={inputByParticipantId.get(participant.participantId) ?? ''}
            />
          </View>
        ))}
      </View>
      <Text style={styles.splitHelper}>
        입력 합계 {formatMoney(summary.splitAmountMinor, currency)} / 총액{' '}
        {summary.totalAmountMinor === null ? '-' : formatMoney(summary.totalAmountMinor, currency)}
      </Text>
      {differenceLabel ? <Text style={styles.splitHelper}>{differenceLabel}</Text> : null}
      {errorMessage || summary.validationMessage ? (
        <Text style={styles.errorMessage}>{errorMessage ?? summary.validationMessage}</Text>
      ) : null}
    </View>
  );
}

function manualSplitDifferenceLabel(differenceMinor: number | null, currency: SupportedCurrency): string | null {
  if (differenceMinor === null || differenceMinor === 0) {
    return null;
  }
  if (differenceMinor > 0) {
    return `남은 금액 ${formatMoney(differenceMinor, currency)}`;
  }
  return `초과 금액 ${formatMoney(Math.abs(differenceMinor), currency)}`;
}

function SplitRowsSection({
  helper,
  rows,
  title,
}: {
  helper: string;
  rows: QuickExpenseViewModel['splitPreviewRows'];
  title: string;
}) {
  return (
    <View style={styles.splitSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.splitHelper}>{helper}</Text>
      </View>
      <View style={styles.splitRowList}>
        {rows.map((row, index) => (
          <View key={`${row.participantId ?? 'removed'}-${index}`} style={styles.splitRow}>
            <Text style={styles.splitName}>{row.displayName}</Text>
            <Text style={styles.splitAmount}>{row.amountLabel}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
