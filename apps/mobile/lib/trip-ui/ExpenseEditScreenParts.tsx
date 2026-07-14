import { Pressable, Text, TextInput, View } from 'react-native';

import { type Expense } from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  buildUpdateExpenseRequest,
  type ExpenseEditFormErrors,
  type ExpenseEditViewModel,
} from '../trips/expense-edit';
import {
  buildQuickExpenseManualSplitSummary,
  formatMoney,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitPolicy,
} from '../trips/quick-expense';
import { styles } from './ExpenseEditScreenStyles';

export function ExpenseEditForm({
  amountInput,
  deleting,
  errors,
  formMessage,
  memoInput,
  onAmountChange,
  onDelete,
  onMemoChange,
  onPayerChange,
  onPlaceChange,
  onSave,
  onSplitPolicyChange,
  onTitleChange,
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
  memoInput: string;
  onAmountChange: (value: string) => void;
  onDelete: () => void;
  onMemoChange: (value: string) => void;
  onPayerChange: (value: string) => void;
  onPlaceChange: (value: string | null) => void;
  onSave: () => void;
  onSplitPolicyChange: (value: QuickExpenseSplitPolicy) => void;
  onTitleChange: (value: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  saving: boolean;
  splitPolicy: QuickExpenseSplitPolicy;
  titleInput: string;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  viewModel: ExpenseEditViewModel;
}) {
  const selectedPayerParticipantId = viewModel.payerOptions.find((option) => option.selected)?.participantId ?? null;
  const selectedScheduleItemId = viewModel.placeOptions.find((option) => option.selected)?.itemId ?? null;
  const saveValidation = buildUpdateExpenseRequest({
    amountInput,
    currency: viewModel.currency,
    splitPolicy,
    participantIds: viewModel.payerOptions.map((option) => option.participantId),
    manualSplitInputs,
    scheduleItemId: selectedScheduleItemId,
    memoInput,
    payerParticipantId: selectedPayerParticipantId,
    titleInput,
  });
  const canSave = saveValidation.ok && !saving && !deleting;

  return (
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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>결제자</Text>
        <View style={styles.optionList}>
          {viewModel.payerOptions.map((option) => (
            <Pressable
              key={option.participantId}
              accessibilityRole="button"
              onPress={() => onPayerChange(option.participantId)}
              style={[styles.optionChip, option.selected ? styles.optionChipSelected : null]}
            >
              <Text style={[styles.optionText, option.selected ? styles.optionTextSelected : null]}>
                {option.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.payer ? <Text style={styles.validationText}>{errors.payer}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>연결 장소</Text>
        <View style={styles.optionListVertical}>
          {viewModel.placeOptions.map((option) => (
            <Pressable
              key={option.itemId ?? 'none'}
              accessibilityRole="button"
              onPress={() => onPlaceChange(option.itemId)}
              style={[styles.placeOption, option.selected ? styles.placeOptionSelected : null]}
            >
              <Text style={[styles.optionText, option.selected ? styles.optionTextSelected : null]}>
                {option.label}
              </Text>
              <Text style={styles.optionDetail}>{option.detail}</Text>
            </Pressable>
          ))}
        </View>
      </View>

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

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분할 방식</Text>
        <View style={styles.optionList}>
          {(['equal', 'manual'] as const).map((policy) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: splitPolicy === policy }}
              key={policy}
              onPress={() => onSplitPolicyChange(policy)}
              style={[styles.optionChip, splitPolicy === policy ? styles.optionChipSelected : null]}
            >
              <Text style={[styles.optionText, splitPolicy === policy ? styles.optionTextSelected : null]}>
                {policy === 'equal' ? '균등 분할' : '직접 입력'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {splitPolicy === 'equal' ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>분담 미리보기</Text>
          {viewModel.splitPreviewMessage ? (
            <Text style={styles.validationText}>{viewModel.splitPreviewMessage}</Text>
          ) : null}
          {viewModel.splitPreviewRows.length > 0 ? (
            <View style={styles.splitList}>
              {viewModel.splitPreviewRows.map((row) => (
                <View key={row.participantId ?? row.displayName} style={styles.splitRow}>
                  <Text style={styles.message}>{row.displayName}</Text>
                  <Text style={styles.amountText}>{row.amountLabel}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.message}>금액을 입력하면 현재 참여자 기준으로 나눠 보여줘요.</Text>
          )}
          {errors.participants ? <Text style={styles.validationText}>{errors.participants}</Text> : null}
        </View>
      ) : (
        <ExpenseEditManualSplitSection
          amountInput={amountInput}
          currency={viewModel.currency}
          errorMessage={errors.participants ?? null}
          manualSplitInputs={manualSplitInputs}
          onUpdateManualSplitInput={onUpdateManualSplitInput}
          participants={viewModel.payerOptions}
        />
      )}

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
  );
}

export function ExpenseEditManualSplitSection({
  amountInput,
  currency,
  errorMessage,
  manualSplitInputs,
  onUpdateManualSplitInput,
  participants,
}: {
  amountInput: string;
  currency: Expense['currency'];
  errorMessage: string | null;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  participants: ExpenseEditViewModel['payerOptions'];
}) {
  const summary = buildQuickExpenseManualSplitSummary({ amountInput, currency, manualSplitInputs });
  const inputByParticipantId = new Map(manualSplitInputs.map((split) => [split.participantId, split.amountInput]));
  const differenceLabel = manualSplitDifferenceLabel(summary.differenceMinor, currency);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>직접 입력</Text>
      <Text style={styles.readOnlyText}>참여자별 부담 금액을 입력해주세요. 합계가 총 지출 금액과 같아야 해요.</Text>
      <View style={styles.splitList}>
        {participants.map((participant) => (
          <View key={participant.participantId} style={styles.manualSplitRow}>
            <Text style={styles.message}>{participant.displayName}</Text>
            <TextInput
              accessibilityLabel={`${participant.displayName} 부담 금액`}
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
      <Text style={styles.readOnlyText}>
        입력 합계 {formatMoney(summary.splitAmountMinor, currency)} / 총액{' '}
        {summary.totalAmountMinor === null ? '-' : formatMoney(summary.totalAmountMinor, currency)}
      </Text>
      {differenceLabel ? <Text style={styles.readOnlyText}>{differenceLabel}</Text> : null}
      {errorMessage || summary.validationMessage ? (
        <Text style={styles.validationText}>{errorMessage ?? summary.validationMessage}</Text>
      ) : null}
    </View>
  );
}

function manualSplitDifferenceLabel(differenceMinor: number | null, currency: Expense['currency']): string | null {
  if (differenceMinor === null || differenceMinor === 0) {
    return null;
  }
  if (differenceMinor > 0) {
    return `남은 금액 ${formatMoney(differenceMinor, currency)}`;
  }
  return `초과 금액 ${formatMoney(Math.abs(differenceMinor), currency)}`;
}
