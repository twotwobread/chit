import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type SupportedCurrency } from '@i-um/api-contract';

import { ChoiceChip, FormField, InlineAction, PrimaryButton, SegmentedControl, theme } from '../design';
import { expenseCategoryValues, getExpenseCategoryMarkerMeta, type ExpenseCategory } from './expense-category-markers';
import {
  buildQuickExpenseManualSplitSummary,
  formatMoney,
  type QuickExpenseManualSplitInput,
  type QuickExpenseSplitPolicy,
  type QuickExpenseSplitRow,
} from '../trips/quick-expense';
import { BottomSheet } from './BottomSheet';
import { DayChips } from './DayChips';

export type ExpenseFormDayOption = {
  tripDayId: string;
  dayLabel: string;
  formattedDate?: string;
  itemCount: number;
};

export type ExpenseFormItemOption = {
  itemId: string;
  tripDayId: string;
  dayLabel: string;
  formattedDate: string;
  orderLabel: string;
  placeName: string;
  placeTypeLabel: string;
  address: string;
  timeLabel: string | null;
};

export type ExpenseFormParticipantOption = {
  participantId: string;
  displayName: string;
  selected: boolean;
};

const supportedCurrencyValues: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];
const SPLIT_POLICY_LABELS: Record<QuickExpenseSplitPolicy, string> = {
  equal: '1/N 분할',
  manual: '직접 분할',
};
const splitPolicyOptions = [SPLIT_POLICY_LABELS.equal, SPLIT_POLICY_LABELS.manual];

export function ExpenseCurrencySelector({
  currency,
  disabled,
  onSelectCurrency,
}: {
  currency: SupportedCurrency;
  disabled: boolean;
  onSelectCurrency: (currency: SupportedCurrency) => void;
}) {
  return (
    <FormField disabled={disabled} label="통화">
      <View style={styles.optionList}>
        {supportedCurrencyValues.map((option) => {
          const selected = option === currency;
          return (
            <ChoiceChip
              disabled={disabled}
              key={option}
              label={currencyOptionLabel(option)}
              onPress={() => onSelectCurrency(option)}
              selected={selected}
            />
          );
        })}
      </View>
    </FormField>
  );
}

export function ExpenseCategorySelector({
  disabled,
  expenseCategory,
  onSelectExpenseCategory,
}: {
  disabled: boolean;
  expenseCategory: ExpenseCategory;
  onSelectExpenseCategory: (expenseCategory: ExpenseCategory) => void;
}) {
  return (
    <FormField disabled={disabled} helperText="장소 종류와 별개로 지출 카테고리를 정할 수 있어요." label="카테고리">
      <View style={styles.optionList}>
        {expenseCategoryValues.map((option) => {
          const selected = option === expenseCategory;
          return (
            <ChoiceChip
              disabled={disabled}
              key={option}
              label={getExpenseCategoryMarkerMeta(option).label}
              onPress={() => onSelectExpenseCategory(option)}
              selected={selected}
            />
          );
        })}
      </View>
    </FormField>
  );
}

export function ExpenseFormSummaryActionRow({
  disabled,
  helper,
  onPress,
  title,
  value,
}: {
  disabled: boolean;
  helper?: string;
  onPress: () => void;
  title: string;
  value: string;
}) {
  return (
    <FormField disabled={disabled} helperText={helper} label={title}>
      <InlineAction
        accessibilityLabel={`${title} 변경`}
        disabled={disabled}
        label={value}
        onPress={onPress}
        style={styles.summaryRow}
        trailing={<Text style={styles.summaryAction}>변경</Text>}
      />
    </FormField>
  );
}

export function ExpenseFormScheduleSelector({
  dayLabel,
  dayOptions,
  disabled,
  emptyItemTitle,
  errorMessage,
  itemLabel,
  itemOptions,
  onClearTripDay,
  onSelectItem,
  onSelectTripDay,
  selectedItem,
  selectedItemId,
  selectedTripDayId,
  showAllScheduleContext,
  showClearDayOption,
  showDayTabs,
  showItemSelector,
}: {
  dayLabel: string;
  dayOptions: ExpenseFormDayOption[];
  disabled: boolean;
  emptyItemTitle: string;
  errorMessage?: string;
  itemLabel: string;
  itemOptions: ExpenseFormItemOption[];
  onClearTripDay?: () => void;
  onSelectItem: (itemId: string) => void;
  onSelectTripDay: (tripDayId: string) => void;
  selectedItem: ExpenseFormItemOption | null;
  selectedItemId: string | null;
  selectedTripDayId: string | null;
  showAllScheduleContext: boolean;
  showClearDayOption: boolean;
  showDayTabs: boolean;
  showItemSelector: boolean;
}) {
  const [itemSelectorExpanded, setItemSelectorExpanded] = useState(false);
  const selectedItemTitle = selectedItem
    ? `${showAllScheduleContext ? `${selectedItem.dayLabel} · ` : ''}${selectedItem.placeName}`
    : emptyItemTitle;

  const selectTripDay = (tripDayId: string) => {
    onSelectTripDay(tripDayId);
    setItemSelectorExpanded(false);
  };
  const clearTripDay = () => {
    onClearTripDay?.();
    setItemSelectorExpanded(false);
  };
  const selectItem = (itemId: string) => {
    onSelectItem(itemId);
    setItemSelectorExpanded(false);
  };

  if (!showDayTabs && (!showItemSelector || itemOptions.length === 0)) {
    return null;
  }

  return (
    <>
      {showDayTabs ? (
        <FormField disabled={disabled} label={dayLabel}>
          {showClearDayOption ? (
            <ChoiceChip
              disabled={disabled}
              label="선택 안 함"
              onPress={clearTripDay}
              selected={selectedTripDayId === null}
            />
          ) : null}
          <DayChips
            days={dayOptions.map((option) => ({
              id: option.tripDayId,
              label: option.dayLabel,
              statusLabel: `일정 ${option.itemCount}개`,
            }))}
            edgePadding={0}
            onSelectDay={selectTripDay}
            selectedDayId={selectedTripDayId}
          />
        </FormField>
      ) : null}

      {showItemSelector && itemOptions.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{itemLabel}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: itemSelectorExpanded }}
            disabled={disabled}
            onPress={() => setItemSelectorExpanded((expanded) => !expanded)}
            style={({ pressed }) => [
              styles.scheduleSelectorButton,
              selectedItem ? null : styles.scheduleSelectorButtonEmpty,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.scheduleSelectorTextColumn}>
              <Text style={styles.optionTitle}>{selectedItemTitle}</Text>
              {selectedItem?.timeLabel ? <Text style={styles.timeLabel}>{selectedItem.timeLabel}</Text> : null}
              {selectedItem?.address ? (
                <Text numberOfLines={1} style={styles.address}>
                  {selectedItem.address}
                </Text>
              ) : null}
            </View>
            <Text style={styles.summaryAction}>{itemSelectorExpanded ? '닫기' : '변경'}</Text>
          </Pressable>
          {itemSelectorExpanded ? (
            <View style={styles.scheduleSelectorMenu}>
              {itemOptions.map((option) => {
                const selected = option.itemId === selectedItemId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={disabled}
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
          {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

export function ExpensePaymentSplitSheet({
  amountInput,
  currency,
  disabled,
  manualSplitInputs,
  onClose,
  onSelectPayer,
  onSelectSplitPolicy,
  onToggleSplitParticipant,
  onUpdateManualSplitInput,
  participantError,
  participants,
  payerError,
  payerOptions,
  splitPolicy,
  splitPreviewMessage,
  splitPreviewRows,
  visible,
}: {
  amountInput: string;
  currency: SupportedCurrency;
  disabled: boolean;
  manualSplitInputs: QuickExpenseManualSplitInput[];
  onClose: () => void;
  onSelectPayer: (participantId: string) => void;
  onSelectSplitPolicy: (policy: QuickExpenseSplitPolicy) => void;
  onToggleSplitParticipant: (participantId: string) => void;
  onUpdateManualSplitInput: (participantId: string, amount: string) => void;
  participantError?: string | null;
  participants: ExpenseFormParticipantOption[];
  payerError?: string | null;
  payerOptions: ExpenseFormParticipantOption[];
  splitPolicy: QuickExpenseSplitPolicy;
  splitPreviewMessage?: string | null;
  splitPreviewRows: QuickExpenseSplitRow[];
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} scrollable visible={visible}>
      <View style={styles.sheetContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sheetTitle}>결제/분할 설정</Text>
          <Text style={styles.helper}>누가 냈고 누구와 나눌지 설정해요.</Text>
        </View>

        <FormField disabled={disabled} errorText={payerError ?? undefined} label="결제자">
          <View style={styles.optionList}>
            {payerOptions.map((option) => (
              <ChoiceChip
                disabled={disabled}
                key={option.participantId}
                label={option.displayName}
                onPress={() => onSelectPayer(option.participantId)}
                selected={option.selected}
              />
            ))}
          </View>
        </FormField>

        <FormField disabled={disabled} label="분할 방식">
          <SegmentedControl
            disabledOptions={disabled ? splitPolicyOptions : []}
            onChange={(value) => onSelectSplitPolicy(value === SPLIT_POLICY_LABELS.equal ? 'equal' : 'manual')}
            options={splitPolicyOptions}
            value={SPLIT_POLICY_LABELS[splitPolicy]}
          />
        </FormField>

        {splitPolicy === 'equal' ? (
          <>
            <View style={styles.fieldGroup}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>분할 대상</Text>
                <Text style={styles.helper}>체크한 사람에게만 아래 금액으로 나눠져요. 결제자도 제외할 수 있어요.</Text>
              </View>
              <View style={styles.optionList}>
                {participants.map((option) => (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: option.selected }}
                    disabled={disabled}
                    key={option.participantId}
                    onPress={() => onToggleSplitParticipant(option.participantId)}
                    style={[styles.chip, option.selected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, option.selected ? styles.chipTextSelected : null]}>
                      {option.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {participantError ? <Text style={styles.errorMessage}>{participantError}</Text> : null}
            </View>

            {splitPreviewRows.length > 0 ? (
              <ExpenseSplitRowsSection
                helper="저장하면 선택한 참여자에게 아래 금액으로 나눠져요."
                rows={splitPreviewRows}
                title="예상 분담금"
              />
            ) : (
              <Text style={styles.message}>금액을 입력하면 선택한 참여자 기준으로 나눠 보여줘요.</Text>
            )}
          </>
        ) : (
          <ExpenseManualSplitSection
            amountInput={amountInput}
            currency={currency}
            disabled={disabled}
            errorMessage={participantError ?? null}
            manualSplitInputs={manualSplitInputs}
            onToggleSplitParticipant={onToggleSplitParticipant}
            onUpdateManualSplitInput={onUpdateManualSplitInput}
            participants={participants}
          />
        )}

        {splitPreviewMessage ? <Text style={styles.errorMessage}>{splitPreviewMessage}</Text> : null}
        <PrimaryButton label="적용" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

export function ExpenseSettlementOptionSheet({
  includeInSettlement,
  onClose,
  onSelectIncludeInSettlement,
  visible,
}: {
  includeInSettlement: boolean;
  onClose: () => void;
  onSelectIncludeInSettlement: (includeInSettlement: boolean) => void;
  visible: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} visible={visible}>
      <View style={styles.sheetContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sheetTitle}>정산 옵션</Text>
          <Text style={styles.helper}>현장에서 이미 돈을 주고받은 지출인지 선택해요.</Text>
        </View>
        <ExpenseSettlementChoice
          description="나중에 여행 정산에서 함께 계산할 지출이에요."
          label="최종 정산에 포함"
          onPress={() => onSelectIncludeInSettlement(true)}
          selected={includeInSettlement}
        />
        <ExpenseSettlementChoice
          description="이미 돈을 주고받은 지출이에요. 내역과 총 사용 금액에는 남고 최종 정산에서는 제외돼요."
          label="현장 정산 완료"
          onPress={() => onSelectIncludeInSettlement(false)}
          selected={!includeInSettlement}
        />
        <PrimaryButton label="적용" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

export function ExpenseSplitRowsSection({
  helper,
  rows,
  title,
}: {
  helper: string;
  rows: QuickExpenseSplitRow[];
  title: string;
}) {
  return (
    <View style={styles.splitSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.helper}>{helper}</Text>
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

function ExpenseManualSplitSection({
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
  participants: ExpenseFormParticipantOption[];
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
        <Text style={styles.helper}>분할할 참여자를 선택하고 각 부담 금액을 입력해주세요.</Text>
      </View>
      <View style={styles.optionList}>
        {participants.map((participant) => (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: participant.selected }}
            disabled={disabled}
            key={participant.participantId}
            onPress={() => onToggleSplitParticipant(participant.participantId)}
            style={[styles.chip, participant.selected ? styles.chipSelected : null]}
          >
            <Text style={[styles.chipText, participant.selected ? styles.chipTextSelected : null]}>
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
      <Text style={styles.helper}>
        입력 합계 {formatMoney(summary.splitAmountMinor, currency)} / 총액{' '}
        {summary.totalAmountMinor === null ? '-' : formatMoney(summary.totalAmountMinor, currency)}
      </Text>
      {differenceLabel ? <Text style={styles.helper}>{differenceLabel}</Text> : null}
      {errorMessage || summary.validationMessage ? (
        <Text style={styles.errorMessage}>{errorMessage ?? summary.validationMessage}</Text>
      ) : null}
    </View>
  );
}

function ExpenseSettlementChoice({
  description,
  label,
  onPress,
  selected,
}: {
  description: string;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
    >
      <Text style={styles.optionTitle}>{label}</Text>
      <Text style={styles.helper}>{description}</Text>
    </Pressable>
  );
}

function currencyOptionLabel(currency: SupportedCurrency): string {
  switch (currency) {
    case 'KRW':
      return 'KRW 원';
    case 'JPY':
      return 'JPY 엔';
    case 'USD':
      return 'USD 달러';
    case 'EUR':
      return 'EUR 유로';
    default: {
      const exhaustive: never = currency;
      return exhaustive;
    }
  }
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

const styles = StyleSheet.create({
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  chip: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  chipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  chipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  chipTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  dayBadge: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  disabled: {
    opacity: 0.55,
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  helper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  manualSplitInput: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minWidth: 120,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
    textAlign: 'right',
  },
  manualSplitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  modeChip: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  modeRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  optionCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  optionCardSelected: {
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  optionList: {
    gap: theme.space[3],
  },
  optionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  orderBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  placeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  placeType: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  pressed: {
    opacity: 0.72,
  },
  scheduleSelectorButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.controlHLg,
    padding: theme.space[4],
  },
  scheduleSelectorButtonEmpty: {
    backgroundColor: theme.color.surface,
  },
  scheduleSelectorMenu: {
    gap: theme.space[3],
  },
  scheduleSelectorTextColumn: {
    flex: 1,
    gap: theme.space[1],
  },
  sectionHeader: {
    gap: theme.space[2],
  },
  sheetContent: {
    gap: theme.space[5],
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  splitAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  splitName: {
    color: theme.color.textBody,
    flex: 1,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  splitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  splitRowList: {
    gap: theme.space[3],
  },
  splitSection: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  summaryAction: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  summaryRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    padding: theme.space[4],
  },
  summaryTextColumn: {
    flex: 1,
    gap: theme.space[1],
  },
  summaryValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  timeLabel: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
});
