import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  buildUpdateExpenseRequest,
  type ExpenseEditFormErrors,
  type ExpenseEditViewModel,
} from '../trips/expense-edit';
import {
  buildExpensePaymentSplitSummaryLabel,
  settlementStatusSummaryDetail,
  settlementStatusSummaryLabel,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitPolicy,
} from '../trips/quick-expense';
import {
  ExpenseFormScheduleSelector,
  ExpenseFormSummaryActionRow,
  ExpensePaymentSplitSheet,
  ExpenseSettlementOptionSheet,
} from './ExpenseFormSharedParts';
import { styles } from './ExpenseEditScreenStyles';

export function ExpenseEditForm({
  amountInput,
  deleting,
  errors,
  formMessage,
  includeInSettlement,
  memoInput,
  onAmountChange,
  onDelete,
  onMemoChange,
  onPayerChange,
  onSettlementIncludeChange,
  onClearTripDay,
  onPlaceChange,
  onSave,
  onSelectTripDay,
  onSplitPolicyChange,
  onTitleChange,
  onToggleSplitParticipant,
  onUpdateManualSplitInput,
  saving,
  splitPolicy,
  titleInput,
  manualSplitInputs,
  viewModel,
}: {
  amountInput: string;
  deleting: boolean;
  errors: ExpenseEditFormErrors;
  formMessage: string | null;
  includeInSettlement: boolean;
  memoInput: string;
  onAmountChange: (value: string) => void;
  onDelete: () => void;
  onMemoChange: (value: string) => void;
  onPayerChange: (value: string) => void;
  onSettlementIncludeChange: (value: boolean) => void;
  onClearTripDay: () => void;
  onPlaceChange: (value: string | null) => void;
  onSave: () => void;
  onSelectTripDay: (tripDayId: string) => void;
  onSplitPolicyChange: (value: QuickExpenseSplitPolicy) => void;
  onTitleChange: (value: string) => void;
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  saving: boolean;
  splitPolicy: QuickExpenseSplitPolicy;
  titleInput: string;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  viewModel: ExpenseEditViewModel;
}) {
  const selectedPayerParticipantId = viewModel.payerOptions.find((option) => option.selected)?.participantId ?? null;
  const selectedScheduleItemId = viewModel.selectedItem?.itemId ?? null;
  const selectedSplitParticipantIds = viewModel.splitParticipantOptions
    .filter((option) => option.selected)
    .map((option) => option.participantId);
  const activeManualSplitInputs = manualSplitInputs.filter((input) =>
    selectedSplitParticipantIds.includes(input.participantId),
  );
  const saveValidation = buildUpdateExpenseRequest({
    amountInput,
    currency: viewModel.currency,
    splitPolicy,
    participantIds: selectedSplitParticipantIds,
    manualSplitInputs: activeManualSplitInputs,
    scheduleItemId: selectedScheduleItemId,
    memoInput,
    payerParticipantId: selectedPayerParticipantId,
    titleInput,
    includeInSettlement,
  });
  const canSave = saveValidation.ok && !saving && !deleting;
  const [activeSheet, setActiveSheet] = useState<'split' | 'settlement' | null>(null);
  const showDayTabs = viewModel.dayOptions.length > 0;
  const showAllScheduleContext = viewModel.selectedTripDayId === null && viewModel.dayOptions.length > 0;
  const paymentSplitSummary = buildExpensePaymentSplitSummaryLabel({
    payerParticipantId: selectedPayerParticipantId,
    participants: viewModel.splitParticipantOptions.map((option) => ({
      participantId: option.participantId,
      displayName: option.displayName,
    })),
    selectedParticipantIds: selectedSplitParticipantIds,
    splitPolicy,
  });
  const splitErrorMessage =
    errors.payer ?? errors.participants ?? viewModel.splitParticipantError ?? viewModel.splitPreviewMessage;
  const settlementSummary = settlementStatusSummaryLabel(includeInSettlement);
  const settlementDetail = settlementStatusSummaryDetail(includeInSettlement);

  return (
    <>
      <Card>
        <View style={styles.headerBlock}>
          <Text style={styles.sectionTitle}>{viewModel.dayLabel}</Text>
          <Text style={styles.message}>{viewModel.formattedDate}</Text>
        </View>

        {viewModel.showTitleField ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>지출명</Text>
            <TextInput
              accessibilityLabel="지출명"
              onChangeText={onTitleChange}
              placeholder={viewModel.titlePlaceholder}
              placeholderTextColor={theme.color.textFaint}
              style={[styles.input, errors.title ? styles.inputError : null]}
              value={titleInput}
            />
            {errors.title ? <Text style={styles.validationText}>{errors.title}</Text> : null}
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>금액</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={onAmountChange}
            placeholder={viewModel.amountLabel}
            placeholderTextColor={theme.color.textFaint}
            style={[styles.input, errors.amount ? styles.inputError : null]}
            value={amountInput}
          />
          {errors.amount ? <Text style={styles.validationText}>{errors.amount}</Text> : null}
          <Text style={styles.readOnlyText}>
            통화: {viewModel.currency} · {viewModel.currencyLabel}
          </Text>
        </View>

        <ExpenseFormSummaryActionRow
          disabled={saving || deleting}
          onPress={() => setActiveSheet('split')}
          title="결제/분할"
          value={paymentSplitSummary}
        />
        {splitErrorMessage ? <Text style={styles.validationText}>{splitErrorMessage}</Text> : null}

        <ExpenseFormScheduleSelector
          dayLabel="관련 여행일"
          dayOptions={viewModel.dayOptions}
          disabled={saving || deleting}
          emptyItemTitle="일정 선택 안 함"
          itemLabel="관련 일정"
          itemOptions={viewModel.itemOptions}
          onClearTripDay={onClearTripDay}
          onSelectItem={onPlaceChange}
          onSelectTripDay={onSelectTripDay}
          selectedItem={viewModel.selectedItem}
          selectedItemId={selectedScheduleItemId}
          selectedTripDayId={viewModel.selectedTripDayId}
          showAllScheduleContext={showAllScheduleContext}
          showClearDayOption
          showDayTabs={showDayTabs}
          showItemSelector={viewModel.showPlaceField}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>메모</Text>
          <TextInput
            multiline
            onChangeText={onMemoChange}
            placeholder="메모를 입력해주세요."
            placeholderTextColor={theme.color.textFaint}
            style={[styles.input, styles.memoInput, errors.memo ? styles.inputError : null]}
            value={memoInput}
          />
          {errors.memo ? <Text style={styles.validationText}>{errors.memo}</Text> : null}
        </View>

        <ExpenseFormSummaryActionRow
          disabled={saving || deleting}
          helper={settlementDetail}
          onPress={() => setActiveSheet('settlement')}
          title="정산 옵션"
          value={settlementSummary}
        />

        {formMessage ? <Text style={styles.validationText}>{formMessage}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton
            disabled={!canSave}
            label={viewModel.saveLabel}
            loading={saving}
            loadingLabel="저장 중..."
            onPress={onSave}
          />
          <SecondaryButton
            disabled={saving || deleting}
            label={deleting ? '삭제 중...' : viewModel.deleteLabel}
            onPress={onDelete}
          />
        </View>
      </Card>

      <ExpensePaymentSplitSheet
        amountInput={amountInput}
        currency={viewModel.currency}
        disabled={saving || deleting}
        manualSplitInputs={manualSplitInputs}
        onClose={() => setActiveSheet(null)}
        onSelectPayer={onPayerChange}
        onSelectSplitPolicy={onSplitPolicyChange}
        onToggleSplitParticipant={onToggleSplitParticipant}
        onUpdateManualSplitInput={onUpdateManualSplitInput}
        participantError={errors.participants ?? viewModel.splitParticipantError}
        participants={viewModel.splitParticipantOptions}
        payerError={errors.payer}
        payerOptions={viewModel.payerOptions}
        splitPolicy={splitPolicy}
        splitPreviewMessage={viewModel.splitPreviewMessage}
        splitPreviewRows={viewModel.splitPreviewRows}
        visible={activeSheet === 'split'}
      />

      <ExpenseSettlementOptionSheet
        includeInSettlement={includeInSettlement}
        onClose={() => setActiveSheet(null)}
        onSelectIncludeInSettlement={onSettlementIncludeChange}
        visible={activeSheet === 'settlement'}
      />
    </>
  );
}
