import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { type ExpenseReceiptDraft, type SupportedCurrency } from '@i-um/api-contract';

import { type ExpenseCategory } from './expense-category-markers';

import { Card, FormField, PrimaryButton, SecondaryButton, TextInputField, theme } from '../design';
import { dateFromString, isValidDate, monthStringFromDate } from '../trips/date';
import { TripDateFieldButton, TripDatePicker } from '../trips/date-picker';
import {
  buildCreateQuickExpenseRequest,
  buildCreateTripExpenseRequest,
  buildExpensePaymentSplitSummaryLabel,
  buildQuickExpenseEntryChoiceViewModel,
  type QuickExpenseFormErrors,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSavedSplitSummary,
  type QuickExpenseSplitPolicy,
  type QuickExpenseViewModel,
  settlementStatusSummaryDetail,
  settlementStatusSummaryLabel,
} from '../trips/quick-expense';
import {
  ExpenseCategorySelector,
  ExpenseCurrencySelector,
  ExpenseFormScheduleSelector,
  ExpenseFormSummaryActionRow,
  ExpensePaymentSplitSheet,
  ExpenseSettlementOptionSheet,
  ExpenseSplitRowsSection,
} from './ExpenseFormSharedParts';
import { ReceiptCaptureScanner } from './ReceiptCaptureScanner';
import { styles } from './QuickExpenseEntryStyles';

export type QuickExpenseFormSubmitStateInput = {
  amountInput: string;
  expenseCategory: ExpenseCategory;
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
  expenseCategory,
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
          expenseCategory,
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
          expenseCategory,
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
  expenseCategory,
  expenseDateInput,
  formMessage,
  includeInSettlement,
  mode,
  onBack,
  onClearReceiptDraft,
  onClearTripDay,
  onSelectCurrency,
  onSelectExpenseCategory,
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
  onMemoFocus,
  onMemoLayout,
  onReceiptDraftCreated,
  payerParticipantId,
  receiptBusy,
  receiptDraft,
  receiptMessage,
  saving,
  selectedItemId,
  selectedSplitParticipantIds,
  showActions = true,
  splitPolicy,
  manualSplitInputs,
  memoInput,
  titleInput,
  tripId,
  tripName,
  viewModel,
}: {
  amountInput: string;
  errors: QuickExpenseFormErrors;
  expenseCategory: ExpenseCategory;
  expenseDateInput: string;
  formMessage: string | null;
  includeInSettlement: boolean;
  mode: 'today' | 'settlement';
  onBack: () => void;
  onClearTripDay: () => void;
  onSelectCurrency: (currency: SupportedCurrency) => void;
  onSelectExpenseCategory: (expenseCategory: ExpenseCategory) => void;
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
  onMemoFocus?: () => void;
  onMemoLayout?: (layout: { height: number; y: number }) => void;
  payerParticipantId: string | null;
  receiptBusy: boolean;
  receiptDraft: ExpenseReceiptDraft | null;
  receiptMessage: string | null;
  onClearReceiptDraft: () => void;
  onReceiptDraftCreated: (draft: ExpenseReceiptDraft) => void;
  saving: boolean;
  selectedItemId: string | null;
  selectedSplitParticipantIds: string[];
  showActions?: boolean;
  splitPolicy: QuickExpenseSplitPolicy;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  memoInput: string;
  titleInput: string;
  tripId: string;
  tripName: string;
  viewModel: QuickExpenseViewModel;
}) {
  const submitState = buildQuickExpenseFormSubmitState({
    amountInput,
    expenseCategory,
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
  const [entryMode, setEntryMode] = useState<'choice' | 'manual'>(receiptDraft ? 'manual' : 'choice');
  const [scannerVisible, setScannerVisible] = useState(false);
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
  const handleReceiptDraftCreated = (draft: ExpenseReceiptDraft) => {
    setScannerVisible(false);
    setEntryMode('manual');
    onReceiptDraftCreated(draft);
  };
  const handleDirectInput = () => {
    setScannerVisible(false);
    setEntryMode('manual');
  };
  const entryChoice = buildQuickExpenseEntryChoiceViewModel({ hasTripId: Boolean(tripId) });

  if (entryMode === 'choice' && !receiptDraft) {
    return (
      <>
        <Card>
          <View style={styles.fieldGroup}>
            <Text style={styles.screenTitle}>{entryChoice.title}</Text>
            <Text style={styles.helper}>{entryChoice.helper}</Text>
          </View>
          <View style={styles.noticeBox}>
            <Text style={styles.label}>{entryChoice.primaryAction.label}</Text>
            <Text style={styles.helper}>{entryChoice.primaryAction.helper}</Text>
            <PrimaryButton
              disabled={entryChoice.primaryAction.disabled}
              label={entryChoice.primaryAction.label}
              onPress={() => setScannerVisible(true)}
            />
          </View>
          <View style={styles.noticeBox}>
            <Text style={styles.label}>{entryChoice.secondaryAction.label}</Text>
            <Text style={styles.helper}>{entryChoice.secondaryAction.helper}</Text>
            <SecondaryButton label={entryChoice.secondaryAction.label} onPress={handleDirectInput} />
          </View>
          <Text style={styles.helper}>{entryChoice.verificationCopy}</Text>
          <SecondaryButton label="돌아가기" onPress={onBack} />
        </Card>
        <ReceiptCaptureScanner
          onClose={() => setScannerVisible(false)}
          onDirectInput={handleDirectInput}
          onDraftCreated={handleReceiptDraftCreated}
          tripId={tripId}
          visible={scannerVisible}
        />
      </>
    );
  }

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
            <TextInputField
              disabled={saving}
              errorText={errors.title}
              label="지출명"
              onChangeText={onUpdateTitle}
              placeholder={selectedItemId ? '선택 입력' : '예: 항공권, 숙소 예약금'}
              value={titleInput}
            />

            <FormField disabled={saving} errorText={errors.expenseDate} label="결제일자" required>
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
            </FormField>
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

        <FormField disabled={saving || Boolean(viewModel.emptyMessage)} errorText={errors.amount} label="금액" required>
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
        </FormField>

        <ExpenseCurrencySelector
          currency={viewModel.currency}
          disabled={saving || Boolean(viewModel.emptyMessage)}
          onSelectCurrency={onSelectCurrency}
        />

        <ExpenseCategorySelector
          disabled={saving || Boolean(viewModel.emptyMessage)}
          expenseCategory={expenseCategory}
          onSelectExpenseCategory={onSelectExpenseCategory}
        />

        <FormField
          disabled={saving || Boolean(viewModel.emptyMessage)}
          helperText="금액/날짜/지출명 초안은 저장 전 직접 확인해야 해요."
          label="영수증"
        >
          <View style={styles.noticeBox}>
            {receiptDraft ? (
              <Text style={styles.helper}>
                첨부된 초안 · 신뢰도 {receiptConfidenceLabel(receiptDraft.extraction.confidence)}
              </Text>
            ) : null}
            {receiptMessage ? <Text style={styles.helper}>{receiptMessage}</Text> : null}
            <View style={styles.amountRow}>
              <SecondaryButton
                disabled={saving || receiptBusy || Boolean(viewModel.emptyMessage) || !tripId}
                label={receiptDraft ? '다른 영수증 촬영' : '영수증 촬영'}
                onPress={() => setScannerVisible(true)}
              />
              {receiptDraft ? (
                <SecondaryButton
                  disabled={saving || receiptBusy}
                  label={receiptBusy ? '해제 중...' : '초안 해제'}
                  onPress={onClearReceiptDraft}
                />
              ) : null}
            </View>
          </View>
        </FormField>

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

        <View onLayout={(event) => onMemoLayout?.(event.nativeEvent.layout)}>
          <TextInputField
            disabled={saving || Boolean(viewModel.emptyMessage)}
            inputStyle={styles.memoInput}
            label="메모"
            multiline
            onChangeText={onUpdateMemo}
            onFocus={onMemoFocus}
            placeholder="선택 입력"
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
      <ReceiptCaptureScanner
        onClose={() => setScannerVisible(false)}
        onDirectInput={handleDirectInput}
        onDraftCreated={handleReceiptDraftCreated}
        tripId={tripId}
        visible={scannerVisible}
      />
    </>
  );
}

function receiptConfidenceLabel(confidence: string): string {
  if (confidence === 'high') {
    return '높음';
  }
  if (confidence === 'medium') {
    return '보통';
  }
  return '낮음';
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
