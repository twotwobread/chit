import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { type ExpenseReceiptDraft, type SupportedCurrency } from '@i-um/api-contract';

import { expenseCategoryValues, getExpenseCategoryMarkerMeta, type ExpenseCategory } from './expense-category-markers';

import {
  Card,
  FormField,
  InlineAction,
  PrimaryButton,
  SecondaryButton,
  SelectableCard,
  TextInputField,
  theme,
} from '../design';
import { dateFromString, isValidDate, monthStringFromDate } from '../trips/date';
import { TripDateFieldButton, TripDatePicker } from '../trips/date-picker';
import {
  buildCreateQuickExpenseRequest,
  buildCreateTripExpenseRequest,
  buildExpensePaymentSplitSummaryLabel,
  buildQuickExpenseEntryChoiceViewModel,
  formatMoney,
  parseAmountMinor,
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
import { BottomSheet } from './BottomSheet';
import { DayChips } from './DayChips';
import { ReceiptCaptureScanner } from './ReceiptCaptureScanner';
import { styles } from './QuickExpenseEntryStyles';

const supportedCurrencyOptions: { currency: SupportedCurrency; label: string; description: string }[] = [
  { currency: 'KRW', label: 'KRW 원', description: '한국 원화로 기록해요.' },
  { currency: 'JPY', label: 'JPY 엔', description: '일본 엔화로 기록해요.' },
  { currency: 'USD', label: 'USD 달러', description: '미국 달러로 기록해요.' },
  { currency: 'EUR', label: 'EUR 유로', description: '유로로 기록해요.' },
];

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
  const [activeSheet, setActiveSheet] = useState<'split' | 'settlement' | 'schedule' | 'category' | 'currency' | null>(
    null,
  );
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
  const receiptPlaceCandidateName = receiptDraft?.extraction.placeCandidateName?.trim() || null;
  const receiptPlaceCandidateAddress = receiptDraft?.extraction.placeCandidateAddress?.trim() || null;
  const receiptPlaceCandidateWarnings = receiptDraft?.extraction.placeCandidateWarnings ?? [];
  const showReceiptPlaceCandidate = Boolean(receiptPlaceCandidateName && receiptPlaceCandidateAddress);
  const formDisabled = saving || Boolean(viewModel.emptyMessage);
  const detailedTitle = titleInput.trim() || viewModel.selectedItem?.placeName || '지출명을 확인해주세요';
  const detailedAmount = detailedExpenseAmountLabel(amountInput, viewModel.currency);
  const detailedPayer = selectedPayerOptions.find((option) => option.selected)?.displayName ?? '결제자 선택 필요';
  const detailedDate = expenseDateInput.trim() || '결제일자 선택 필요';
  const detailedCategoryLabel = getExpenseCategoryMarkerMeta(expenseCategory).label;
  const detailedCurrencyLabel = detailedCurrencyOptionLabel(viewModel.currency);
  const detailedSchedule = detailedScheduleLinkSummary(viewModel);
  const selectExpenseCategoryFromSheet = (nextExpenseCategory: ExpenseCategory) => {
    onSelectExpenseCategory(nextExpenseCategory);
    setActiveSheet(null);
  };
  const selectCurrencyFromSheet = (currency: SupportedCurrency) => {
    onSelectCurrency(currency);
    setActiveSheet(null);
  };
  const clearScheduleLinkFromSheet = () => {
    onClearTripDay();
    setActiveSheet(null);
  };
  const selectScheduleItemFromSheet = (itemId: string) => {
    onSelectItem(itemId);
    setActiveSheet(null);
  };

  const renderMemoInput = (disabled: boolean) => (
    <View onLayout={(event) => onMemoLayout?.(event.nativeEvent.layout)}>
      <TextInputField
        disabled={disabled}
        inputStyle={styles.memoInput}
        label="메모"
        multiline
        onChangeText={onUpdateMemo}
        onFocus={onMemoFocus}
        placeholder="선택 입력"
        value={memoInput}
      />
    </View>
  );

  const renderStandardExpenseFields = () => (
    <>
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

      <ExpenseFormScheduleSelector
        dayLabel="일차 선택"
        dayOptions={viewModel.dayOptions}
        disabled={formDisabled}
        emptyItemTitle="일정을 선택해주세요."
        errorMessage={errors.item}
        itemLabel="연결할 일정"
        itemOptions={viewModel.itemOptions}
        onClearTripDay={onClearTripDay}
        onSelectItem={onSelectItem}
        onSelectTripDay={onSelectTripDay}
        selectedItem={viewModel.selectedItem}
        selectedItemId={selectedItemId}
        selectedTripDayId={viewModel.selectedTripDayId}
        showAllScheduleContext={showAllScheduleContext}
        showClearDayOption={false}
        showDayTabs={showDayTabs}
        showItemSelector={viewModel.showItemSelector}
      />

      <FormField disabled={formDisabled} errorText={errors.amount} label="금액" required>
        <View style={styles.amountInputBox}>
          <TextInput
            accessibilityLabel="금액"
            editable={!formDisabled}
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
        disabled={formDisabled}
        onSelectCurrency={onSelectCurrency}
      />

      <ExpenseCategorySelector
        disabled={formDisabled}
        expenseCategory={expenseCategory}
        onSelectExpenseCategory={onSelectExpenseCategory}
      />

      {renderReceiptSection()}

      <ExpenseFormSummaryActionRow
        disabled={formDisabled}
        onPress={() => setActiveSheet('split')}
        title="결제/분할"
        value={paymentSplitSummary}
      />
      {splitErrorMessage ? <Text style={styles.errorMessage}>{splitErrorMessage}</Text> : null}

      <ExpenseFormSummaryActionRow
        disabled={formDisabled}
        helper={settlementDetail}
        onPress={() => setActiveSheet('settlement')}
        title="정산 옵션"
        value={settlementSummary}
      />

      {renderMemoInput(formDisabled)}
    </>
  );

  const renderDetailedExpenseReview = () => (
    <>
      <View style={styles.detailedSummaryCard}>
        <Text style={styles.detailEyebrow}>지출 초안</Text>
        <Text numberOfLines={2} style={styles.detailTitle}>
          {detailedTitle}
        </Text>
        <Text style={styles.detailAmount}>{detailedAmount}</Text>
        <Text style={styles.detailMeta}>
          {detailedDate} · {detailedPayer}
        </Text>
        {receiptDraft ? (
          <Text style={styles.detailBadge}>
            영수증 초안 · 신뢰도 {receiptConfidenceLabel(receiptDraft.extraction.confidence)}
          </Text>
        ) : (
          <Text style={styles.detailBadge}>직접 입력 초안</Text>
        )}
      </View>

      {viewModel.emptyMessage ? (
        <View style={styles.noticeBox}>
          <Text style={styles.message}>{viewModel.emptyMessage}</Text>
        </View>
      ) : null}

      {viewModel.helper ? <Text style={styles.helper}>{viewModel.helper}</Text> : null}

      <DetailedExpenseReviewGroup helper="저장 전 금액, 날짜, 지출명을 먼저 맞춰요." title="먼저 확인">
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

        <FormField disabled={formDisabled} errorText={errors.amount} label="금액" required>
          <View style={styles.amountInputBox}>
            <TextInput
              accessibilityLabel="금액"
              editable={!formDisabled}
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
      </DetailedExpenseReviewGroup>

      <DetailedExpenseReviewGroup helper="기본은 전체 1/N과 최종 정산 포함이에요." title="정산">
        <DetailedExpenseReviewRow
          disabled={formDisabled}
          errorText={splitErrorMessage}
          label="결제/분할"
          onPress={() => setActiveSheet('split')}
          required
          value={paymentSplitSummary}
        />
        <DetailedExpenseReviewRow
          disabled={formDisabled}
          helper={settlementDetail}
          label="정산 상태"
          onPress={() => setActiveSheet('settlement')}
          value={settlementSummary}
        />
      </DetailedExpenseReviewGroup>

      <DetailedExpenseReviewGroup helper="여행 기록과 나중에 찾기 좋은 기준을 정해요." title="분류/연결">
        <DetailedExpenseReviewRow
          disabled={formDisabled}
          errorText={errors.item}
          helper={detailedSchedule.helper}
          label="관련 일정"
          onPress={() => setActiveSheet('schedule')}
          value={detailedSchedule.value}
        />
        <DetailedExpenseMetaPickerRow
          categoryLabel={detailedCategoryLabel}
          currencyLabel={detailedCurrencyLabel}
          disabled={formDisabled}
          onPressCategory={() => setActiveSheet('category')}
          onPressCurrency={() => setActiveSheet('currency')}
        />
      </DetailedExpenseReviewGroup>

      <DetailedExpenseReviewGroup helper="영수증과 메모는 필요할 때만 더해요." title="선택 정보">
        {renderReceiptSection()}
        {renderMemoInput(formDisabled)}
      </DetailedExpenseReviewGroup>
    </>
  );

  const renderReceiptSection = () => (
    <FormField
      disabled={formDisabled}
      helperText="영수증은 선택이에요. 촬영하면 초안을 채우고 저장 전 확인해요."
      label="영수증"
    >
      <View style={styles.noticeBox}>
        {receiptDraft ? (
          <Text style={styles.helper}>
            첨부된 초안 · 신뢰도 {receiptConfidenceLabel(receiptDraft.extraction.confidence)}
          </Text>
        ) : (
          <Text style={styles.helper}>영수증 없이도 직접 입력으로 저장할 수 있어요.</Text>
        )}
        {receiptMessage ? <Text style={styles.helper}>{receiptMessage}</Text> : null}
        {showReceiptPlaceCandidate ? (
          <View style={styles.noticeBox}>
            <Text style={styles.label}>영수증 장소 후보</Text>
            <Text style={styles.helper}>{receiptPlaceCandidateName}</Text>
            <Text style={styles.helper}>{receiptPlaceCandidateAddress}</Text>
            <Text style={styles.helper}>확인하면 여행 장소로만 등록하고 일정에는 추가하지 않아요.</Text>
            {receiptPlaceCandidateWarnings[0] ? (
              <Text style={styles.helper}>{receiptPlaceCandidateWarnings[0]}</Text>
            ) : null}
            <SecondaryButton
              disabled={formDisabled || receiptPlaceBusy || Boolean(selectedTripPlaceId)}
              label={selectedTripPlaceId ? '장소로 등록됨' : receiptPlaceBusy ? '장소 등록 중...' : '여행 장소로 등록'}
              onPress={onCreateReceiptPlaceCandidate}
            />
          </View>
        ) : null}
        <View style={styles.amountRow}>
          <SecondaryButton
            disabled={formDisabled || receiptBusy || !tripId}
            label={receiptDraft ? '다른 영수증 촬영' : '영수증으로 채우기'}
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
  );

  const renderFormActions = () => (
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
  );

  const renderDetailedManualForm = () => (
    <View style={styles.detailedFormSurface}>
      {renderDetailedExpenseReview()}
      {formMessage ? <Text style={styles.errorMessage}>{formMessage}</Text> : null}
      {showActions ? <View style={styles.detailedActionCard}>{renderFormActions()}</View> : null}
    </View>
  );

  const renderStandardManualForm = () => (
    <Card>
      {renderStandardExpenseFields()}
      {formMessage ? <Text style={styles.errorMessage}>{formMessage}</Text> : null}
      {showActions ? renderFormActions() : null}
    </Card>
  );

  const renderManualForm = () => (mode === 'settlement' ? renderDetailedManualForm() : renderStandardManualForm());

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
              onPress={handleDirectInput}
            />
          </View>
          <View style={styles.noticeBox}>
            <Text style={styles.label}>{entryChoice.secondaryAction.label}</Text>
            <Text style={styles.helper}>{entryChoice.secondaryAction.helper}</Text>
            <SecondaryButton
              disabled={entryChoice.secondaryAction.disabled}
              label={entryChoice.secondaryAction.label}
              onPress={() => setScannerVisible(true)}
            />
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
      {renderManualForm()}

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
      <DetailedScheduleLinkSheet
        dayOptions={viewModel.dayOptions}
        disabled={formDisabled}
        itemOptions={viewModel.itemOptions}
        onClearTripDay={clearScheduleLinkFromSheet}
        onClose={() => setActiveSheet(null)}
        onSelectItem={selectScheduleItemFromSheet}
        onSelectTripDay={onSelectTripDay}
        selectedItemId={selectedItemId}
        selectedTripDayId={viewModel.selectedTripDayId}
        visible={activeSheet === 'schedule'}
      />
      <ExpenseCategoryPickerSheet
        disabled={formDisabled}
        expenseCategory={expenseCategory}
        onClose={() => setActiveSheet(null)}
        onSelectExpenseCategory={selectExpenseCategoryFromSheet}
        visible={activeSheet === 'category'}
      />
      <ExpenseCurrencyPickerSheet
        currency={viewModel.currency}
        disabled={formDisabled}
        onClose={() => setActiveSheet(null)}
        onSelectCurrency={selectCurrencyFromSheet}
        visible={activeSheet === 'currency'}
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

function DetailedExpenseReviewGroup({
  children,
  helper,
  title,
}: {
  children: ReactNode;
  helper: string;
  title: string;
}) {
  return (
    <View style={styles.reviewGroup}>
      <View style={styles.sectionHeader}>
        <Text style={styles.reviewGroupTitle}>{title}</Text>
        <Text style={styles.helper}>{helper}</Text>
      </View>
      {children}
    </View>
  );
}

function DetailedExpenseReviewRow({
  disabled,
  errorText,
  helper,
  label,
  onPress,
  required,
  value,
}: {
  disabled: boolean;
  errorText?: string | null;
  helper?: string | null;
  label: string;
  onPress: () => void;
  required?: boolean;
  value: string;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowTextColumn}>
        <Text style={styles.reviewRowLabel}>
          {label}
          {required ? ' · 필수' : ''}
        </Text>
        <Text style={styles.reviewRowValue}>{value}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
        {errorText ? <Text style={styles.errorMessage}>{errorText}</Text> : null}
      </View>
      <InlineAction accessibilityLabel={`${label} 변경`} disabled={disabled} label="변경" onPress={onPress} />
    </View>
  );
}

function DetailedExpenseMetaPickerRow({
  categoryLabel,
  currencyLabel,
  disabled,
  onPressCategory,
  onPressCurrency,
}: {
  categoryLabel: string;
  currencyLabel: string;
  disabled: boolean;
  onPressCategory: () => void;
  onPressCurrency: () => void;
}) {
  return (
    <View style={styles.detailPickerGrid}>
      <DetailedExpensePickerCell disabled={disabled} label="카테고리" onPress={onPressCategory} value={categoryLabel} />
      <DetailedExpensePickerCell disabled={disabled} label="통화" onPress={onPressCurrency} value={currencyLabel} />
    </View>
  );
}

function DetailedExpensePickerCell({
  disabled,
  label,
  onPress,
  value,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  value: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} 변경`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailPickerCell,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <View style={styles.detailPickerValueRow}>
        <Text style={styles.reviewRowValue}>{value}</Text>
        <Text style={styles.summaryAction}>변경</Text>
      </View>
    </Pressable>
  );
}

function DetailedScheduleLinkSheet({
  dayOptions,
  disabled,
  itemOptions,
  onClearTripDay,
  onClose,
  onSelectItem,
  onSelectTripDay,
  selectedItemId,
  selectedTripDayId,
  visible,
}: {
  dayOptions: QuickExpenseViewModel['dayOptions'];
  disabled: boolean;
  itemOptions: QuickExpenseViewModel['itemOptions'];
  onClearTripDay: () => void;
  onClose: () => void;
  onSelectItem: (itemId: string) => void;
  onSelectTripDay: (tripDayId: string) => void;
  selectedItemId: string | null;
  selectedTripDayId: string | null;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} scrollable visible={visible}>
      <View style={styles.sheetContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sheetTitle}>관련 일정 연결</Text>
          <Text style={styles.helper}>일자를 고른 뒤 해당 일자의 일정 목록에서 지출과 연결할 장소를 선택해요.</Text>
        </View>

        <SelectableCard
          checked={selectedTripDayId === null && selectedItemId === null}
          description="특정 일정이 아니라 여행 전체 지출로 저장해요."
          disabled={disabled}
          mode="radio"
          onPress={onClearTripDay}
          title="일정 연결 안 함"
        />

        {dayOptions.length > 0 ? (
          <FormField disabled={disabled} label="일자 선택">
            <DayChips
              days={dayOptions.map((option) => ({
                id: option.tripDayId,
                label: option.dayLabel,
                statusLabel: `일정 ${option.itemCount}개`,
              }))}
              edgePadding={0}
              onSelectDay={onSelectTripDay}
              selectedDayId={selectedTripDayId}
            />
          </FormField>
        ) : null}

        <FormField
          disabled={disabled}
          helperText="일정을 선택하면 카테고리도 일정 종류에 맞춰 자동 보정돼요."
          label="일정 목록"
        >
          {itemOptions.length > 0 ? (
            <View style={styles.optionList}>
              {itemOptions.map((option) => {
                const selected = option.itemId === selectedItemId;
                return (
                  <SelectableCard
                    checked={selected}
                    description={option.address || undefined}
                    disabled={disabled}
                    key={option.itemId}
                    meta={[option.dayLabel, option.timeLabel, option.placeTypeLabel].filter(Boolean).join(' · ')}
                    mode="radio"
                    onPress={() => onSelectItem(option.itemId)}
                    title={option.placeName}
                  />
                );
              })}
            </View>
          ) : (
            <Text style={styles.message}>선택한 일자에 연결할 일정이 없어요.</Text>
          )}
        </FormField>

        <PrimaryButton label="닫기" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

function ExpenseCategoryPickerSheet({
  disabled,
  expenseCategory,
  onClose,
  onSelectExpenseCategory,
  visible,
}: {
  disabled: boolean;
  expenseCategory: ExpenseCategory;
  onClose: () => void;
  onSelectExpenseCategory: (expenseCategory: ExpenseCategory) => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} scrollable visible={visible}>
      <View style={styles.sheetContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sheetTitle}>카테고리 선택</Text>
          <Text style={styles.helper}>지출 내역과 카테고리별 합계에 사용할 기준이에요.</Text>
        </View>
        <View style={styles.optionList}>
          {expenseCategoryValues.map((option) => {
            const meta = getExpenseCategoryMarkerMeta(option);
            return (
              <SelectableCard
                checked={option === expenseCategory}
                description="장소 종류와 별개로 직접 지정할 수 있어요."
                disabled={disabled}
                key={option}
                mode="radio"
                onPress={() => onSelectExpenseCategory(option)}
                title={meta.label}
              />
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

function ExpenseCurrencyPickerSheet({
  currency,
  disabled,
  onClose,
  onSelectCurrency,
  visible,
}: {
  currency: SupportedCurrency;
  disabled: boolean;
  onClose: () => void;
  onSelectCurrency: (currency: SupportedCurrency) => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <View style={styles.sheetContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sheetTitle}>통화 선택</Text>
          <Text style={styles.helper}>환율 변환 없이 선택한 통화 그대로 저장돼요.</Text>
        </View>
        <View style={styles.optionList}>
          {supportedCurrencyOptions.map((option) => (
            <SelectableCard
              checked={option.currency === currency}
              description={option.description}
              disabled={disabled}
              key={option.currency}
              mode="radio"
              onPress={() => onSelectCurrency(option.currency)}
              title={option.label}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

function detailedCurrencyOptionLabel(currency: SupportedCurrency): string {
  return supportedCurrencyOptions.find((option) => option.currency === currency)?.label ?? currency;
}

function detailedScheduleLinkSummary(viewModel: QuickExpenseViewModel): { helper: string; value: string } {
  if (viewModel.selectedItem) {
    const meta = [
      viewModel.selectedItem.dayLabel,
      viewModel.selectedItem.timeLabel,
      viewModel.selectedItem.placeTypeLabel,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      helper: meta || '선택한 일정에 연결돼요.',
      value: viewModel.selectedItem.placeName,
    };
  }

  if (viewModel.selectedTripDayId) {
    const selectedDay = viewModel.dayOptions.find((option) => option.tripDayId === viewModel.selectedTripDayId);
    return {
      helper: '해당 일자의 전체 지출로 저장돼요. 필요하면 일정을 연결할 수 있어요.',
      value: selectedDay ? `${selectedDay.dayLabel} · 일정 선택 안 함` : '일정 선택 안 함',
    };
  }

  return {
    helper: '특정 일정 없이 여행 전체 지출로 저장돼요.',
    value: '일정 연결 안 함',
  };
}

function detailedExpenseAmountLabel(amountInput: string, currency: SupportedCurrency): string {
  const trimmed = amountInput.trim();
  if (!trimmed) {
    return '금액 확인 필요';
  }
  const parsed = parseAmountMinor(trimmed, currency);
  return parsed.ok ? formatMoney(parsed.amountMinor, currency) : `${trimmed} ${currency}`;
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
