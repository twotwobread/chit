import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import { dateFromString, isValidDate, monthStringFromDate } from '../trips/date';
import { TripDateFieldButton, TripDatePicker } from '../trips/date-picker';
import {
  buildCreateQuickExpenseRequest,
  buildCreateTripExpenseRequest,
  buildExpensePaymentSplitSummaryLabel,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseSplitPolicy,
  type QuickExpenseViewModel,
  settlementStatusSummaryDetail,
  settlementStatusSummaryLabel,
} from '../trips/quick-expense';
import {
  ExpenseFormScheduleSelector,
  ExpenseFormSummaryActionRow,
  ExpensePaymentSplitSheet,
  ExpenseSettlementOptionSheet,
  ExpenseSplitRowsSection,
} from './ExpenseFormSharedParts';
import { styles } from './QuickExpenseEntryStyles';

export type QuickExpenseFormSubmitStateInput = {
  amountInput: string;
  expenseDateInput: string;
  includeInSettlement: boolean;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  memoInput: string;
  mode: 'today' | 'settlement';
  payerParticipantId: string | null;
  saving: boolean;
  selectedItemId: string | null;
  selectedSplitParticipantIds: string[];
  splitPolicy: QuickExpenseSplitPolicy;
  titleInput: string;
  viewModel: QuickExpenseViewModel;
};

export function buildQuickExpenseFormSubmitState({
  amountInput,
  expenseDateInput,
  includeInSettlement,
  manualSplitInputs,
  memoInput,
  mode,
  payerParticipantId,
  saving,
  selectedItemId,
  selectedSplitParticipantIds,
  splitPolicy,
  titleInput,
  viewModel,
}: QuickExpenseFormSubmitStateInput): { disabled: boolean } {
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
          includeInSettlement,
        })
      : buildCreateQuickExpenseRequest({
          amountInput,
          currency: viewModel.currency,
          scheduleItemId: selectedItemId,
          splitPolicy,
          participantIds: selectedSplitParticipantIds,
          manualSplitInputs: activeManualSplitInputs,
          payerParticipantId,
          includeInSettlement,
        });

  return { disabled: !validation.ok || saving || Boolean(viewModel.emptyMessage) };
}

export function QuickExpenseForm({
  amountInput,
  errors,
  expenseDateInput,
  formMessage,
  includeInSettlement,
  mode,
  onBack,
  onClearTripDay,
  onSelectItem,
  onSelectPayer,
  onSelectSplitPolicy,
  onSelectTripDay,
  onSubmit,
  onToggleIncludeInSettlement,
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
  showActions = true,
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
  includeInSettlement: boolean;
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
  onToggleIncludeInSettlement: () => void;
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
  showActions?: boolean;
  splitPolicy: QuickExpenseSplitPolicy;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  memoInput: string;
  titleInput: string;
  tripName: string;
  viewModel: QuickExpenseViewModel;
}) {
  const submitState = buildQuickExpenseFormSubmitState({
    amountInput,
    expenseDateInput,
    includeInSettlement,
    manualSplitInputs,
    memoInput,
    mode,
    payerParticipantId,
    saving,
    selectedItemId,
    selectedSplitParticipantIds,
    splitPolicy,
    titleInput,
    viewModel,
  });
  const selectedPayerOptions = viewModel.payerOptions.map((option) => ({
    ...option,
    selected: option.participantId === payerParticipantId,
  }));
  const [activeSheet, setActiveSheet] = useState<'split' | 'settlement' | null>(null);
  const [paymentDatePickerOpen, setPaymentDatePickerOpen] = useState(false);
  const [paymentCalendarMonth, setPaymentCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const showDayContext = viewModel.dayLabel === '전체 일정';
  const showDayTabs = mode === 'settlement' ? viewModel.dayOptions.length > 0 : viewModel.dayOptions.length > 1;
  const showAllScheduleContext = showDayContext && viewModel.selectedTripDayId === null;
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
  const paymentSplitSummary = buildExpensePaymentSplitSummaryLabel({
    payerParticipantId,
    participants: viewModel.splitParticipantOptions.map((option) => ({
      participantId: option.participantId,
      displayName: option.displayName,
    })),
    selectedParticipantIds: selectedSplitParticipantIds,
    splitPolicy,
  });
  const settlementSummary = settlementStatusSummaryLabel(includeInSettlement);
  const settlementDetail = settlementStatusSummaryDetail(includeInSettlement);
  const splitErrorMessage =
    errors.payer ?? errors.participants ?? viewModel.splitParticipantError ?? viewModel.splitPreviewMessage;

  return (
    <>
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

        <ExpenseFormScheduleSelector
          dayLabel={mode === 'settlement' ? '관련 여행일' : '일차 선택'}
          dayOptions={viewModel.dayOptions}
          disabled={saving || Boolean(viewModel.emptyMessage)}
          emptyItemTitle={mode === 'settlement' ? '일정 선택 안 함' : '일정을 선택해주세요.'}
          errorMessage={errors.item}
          itemLabel={mode === 'settlement' ? '관련 일정' : '연결할 일정'}
          itemOptions={viewModel.itemOptions}
          onClearTripDay={onClearTripDay}
          onSelectItem={onSelectItem}
          onSelectTripDay={onSelectTripDay}
          selectedItem={viewModel.selectedItem}
          selectedItemId={selectedItemId}
          selectedTripDayId={viewModel.selectedTripDayId}
          showAllScheduleContext={showAllScheduleContext}
          showClearDayOption={mode === 'settlement'}
          showDayTabs={showDayTabs}
          showItemSelector={viewModel.showItemSelector}
        />

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

        <ExpenseFormSummaryActionRow
          disabled={saving || Boolean(viewModel.emptyMessage)}
          onPress={() => setActiveSheet('split')}
          title="결제/분할"
          value={paymentSplitSummary}
        />
        {splitErrorMessage ? <Text style={styles.errorMessage}>{splitErrorMessage}</Text> : null}

        <ExpenseFormSummaryActionRow
          disabled={saving || Boolean(viewModel.emptyMessage)}
          helper={settlementDetail}
          onPress={() => setActiveSheet('settlement')}
          title="정산 옵션"
          value={settlementSummary}
        />

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

        {showActions ? (
          <>
            <PrimaryButton
              disabled={submitState.disabled}
              label="저장하기"
              loading={saving}
              loadingLabel="저장 중..."
              onPress={onSubmit}
            />
            <SecondaryButton disabled={saving} label="돌아가기" onPress={onBack} />
          </>
        ) : null}
      </Card>

      <ExpensePaymentSplitSheet
        amountInput={amountInput}
        currency={viewModel.currency}
        disabled={saving || Boolean(viewModel.emptyMessage)}
        manualSplitInputs={manualSplitInputs}
        onClose={() => setActiveSheet(null)}
        onSelectPayer={onSelectPayer}
        onSelectSplitPolicy={(policy) => onSelectSplitPolicy(policy, viewModel.splitPreviewRows)}
        onToggleSplitParticipant={onToggleSplitParticipant}
        onUpdateManualSplitInput={onUpdateManualSplitInput}
        participantError={errors.participants ?? viewModel.splitParticipantError}
        participants={viewModel.splitParticipantOptions}
        payerError={errors.payer}
        payerOptions={selectedPayerOptions}
        splitPolicy={splitPolicy}
        splitPreviewMessage={viewModel.splitPreviewMessage}
        splitPreviewRows={viewModel.splitPreviewRows}
        visible={activeSheet === 'split'}
      />

      <ExpenseSettlementOptionSheet
        includeInSettlement={includeInSettlement}
        onClose={() => setActiveSheet(null)}
        onSelectIncludeInSettlement={(nextIncludeInSettlement) => {
          if (nextIncludeInSettlement !== includeInSettlement) {
            onToggleIncludeInSettlement();
          }
        }}
        visible={activeSheet === 'settlement'}
      />
    </>
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
      <ExpenseSplitRowsSection
        helper="서버에 저장된 결과 기준이에요."
        rows={summary.splitRows}
        title="실제 저장된 분할"
      />
      <PrimaryButton label="확인" onPress={onDone} />
    </Card>
  );
}
