import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type ExpenseKind, type ExpenseReceiptDraft } from '@i-um/api-contract';

import {
  FormField,
  InlineAction,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  SelectableCard,
  theme,
} from '../design';
import { cancelExpenseReceiptDraft } from '../trips/expense-api';
import {
  buildExpensePaymentSplitSummaryLabel,
  quickExpenseDirectSplitUnavailableMessage,
  resolveQuickExpenseSheetInitialSplitMode,
  selectQuickExpenseSheetSplitMode,
  settlementStatusSummaryLabel,
  type QuickExpenseSplitPolicy,
} from '../trips/quick-expense';
import { BottomSheet } from './BottomSheet';
import { ReceiptCaptureScanner } from './ReceiptCaptureScanner';

export type QuickExpenseItemOption = {
  id: string;
  label: string;
  helper?: string;
};

export type QuickExpenseParticipantOption = {
  id: string;
  name: string;
  color?: string;
};

export type QuickExpenseDraft = {
  amountInput: string;
  expenseKind: ExpenseKind;
  itemId: string | null;
  payerParticipantId: string | null;
  splitMode: QuickExpenseSplitPolicy;
  splitParticipantIds: string[];
  memoInput: string;
  includeInSettlement: boolean;
};

export type QuickExpenseSubmitPayload = {
  amount: number;
  currency: 'KRW' | 'JPY' | string;
  expenseKind: ExpenseKind;
  itemId: string;
  payerParticipantId: string;
  splitParticipantIds: string[];
  memoInput: string;
  includeInSettlement: boolean;
  receiptDraftId: string | null;
};

export type QuickExpenseFormProps = {
  currency?: 'KRW' | 'JPY' | string;
  itemOptions: QuickExpenseItemOption[];
  participantOptions: QuickExpenseParticipantOption[];
  initialDraft?: Partial<QuickExpenseDraft>;
  onChange?: (draft: QuickExpenseDraft) => void;
  onSave: (payload: QuickExpenseSubmitPayload) => void;
  onCancel?: () => void;
  submitting?: boolean;
  errorMessage?: string | null;
  tripId?: string | null;
};

type QuickExpenseErrors = Partial<Record<'amount' | 'item' | 'payer' | 'participants', string>>;

const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  regular: '일반 지출',
  public_fund: '공금 지출',
};

const EXPENSE_KIND_HELPERS: Record<ExpenseKind, string> = {
  regular: '개인 지출과 대리 구매 모두 일반 지출로 기록해요.',
  public_fund: '공금에서 낸 지출이에요. 기본은 최종 정산 제외예요.',
};

const SPLIT_OPTION_LABELS: Record<QuickExpenseSplitPolicy, string> = {
  equal: '1/N 분할',
  manual: '직접 분할',
};
const SPLIT_OPTIONS = [SPLIT_OPTION_LABELS.equal, SPLIT_OPTION_LABELS.manual];

export function QuickExpenseForm({
  currency = 'JPY',
  errorMessage,
  initialDraft,
  itemOptions,
  onCancel,
  onChange,
  onSave,
  participantOptions,
  submitting = false,
  tripId,
}: QuickExpenseFormProps) {
  const defaultItemId = Object.prototype.hasOwnProperty.call(initialDraft ?? {}, 'itemId')
    ? (initialDraft?.itemId ?? null)
    : (itemOptions[0]?.id ?? null);
  const defaultPayerId = Object.prototype.hasOwnProperty.call(initialDraft ?? {}, 'payerParticipantId')
    ? (initialDraft?.payerParticipantId ?? null)
    : (participantOptions[0]?.id ?? null);
  const defaultSplitIds = initialDraft?.splitParticipantIds ?? participantOptions.map((participant) => participant.id);
  const directSplitUnavailableMessage = quickExpenseDirectSplitUnavailableMessage(participantOptions.length);
  const hasRestoredDraftContent = Boolean(
    initialDraft?.amountInput?.trim() || initialDraft?.memoInput?.trim() || initialDraft?.includeInSettlement === false,
  );
  const defaultSplitMode = resolveQuickExpenseSheetInitialSplitMode({
    requestedSplitMode: initialDraft?.splitMode,
    participantCount: participantOptions.length,
    selectedParticipantCount: defaultSplitIds.length,
  });
  const [draft, setDraft] = useState<QuickExpenseDraft>({
    amountInput: initialDraft?.amountInput ?? '',
    expenseKind: initialDraft?.expenseKind ?? 'regular',
    itemId: defaultItemId,
    payerParticipantId: defaultPayerId,
    splitMode: defaultSplitMode,
    splitParticipantIds: defaultSplitIds,
    memoInput: initialDraft?.memoInput ?? '',
    includeInSettlement: initialDraft?.includeInSettlement ?? true,
  });
  const [errors, setErrors] = useState<QuickExpenseErrors>({});
  const [settlementTouched, setSettlementTouched] = useState(false);
  const [itemSelectorExpanded, setItemSelectorExpanded] = useState(false);
  const [activeSheet, setActiveSheet] = useState<'kind' | 'split' | 'settlement' | null>(null);
  const [entryMode, setEntryMode] = useState<'choice' | 'manual'>(hasRestoredDraftContent ? 'manual' : 'choice');
  const [receiptDraft, setReceiptDraft] = useState<ExpenseReceiptDraft | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const amountInputRef = useRef<TextInput>(null);
  const splitMode = draft.splitMode;
  const selectedItem = useMemo(
    () => itemOptions.find((item) => item.id === draft.itemId) ?? null,
    [draft.itemId, itemOptions],
  );

  useEffect(() => {
    onChange?.(draft);
  }, [draft, onChange]);

  const updateDraft = (patch: Partial<QuickExpenseDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const selectExpenseKind = (expenseKind: ExpenseKind) => {
    setDraft((current) => {
      const includeInSettlementDefault =
        expenseKind === 'regular' ? true : expenseKind === 'public_fund' ? false : current.includeInSettlement;

      return {
        ...current,
        expenseKind,
        includeInSettlement: settlementTouched ? current.includeInSettlement : includeInSettlementDefault,
      };
    });
  };

  const selectSettlementInclusion = (includeInSettlement: boolean) => {
    setSettlementTouched(true);
    updateDraft({ includeInSettlement });
  };

  const selectItem = (itemId: string) => {
    updateDraft({ itemId });
    setItemSelectorExpanded(false);
  };

  const toggleSplitParticipant = (participantId: string) => {
    setDraft((current) => {
      const nextSplitParticipantIds = current.splitParticipantIds.includes(participantId)
        ? current.splitParticipantIds.filter((id) => id !== participantId)
        : [...current.splitParticipantIds, participantId];
      const shouldUseManualMode =
        directSplitUnavailableMessage === null &&
        (current.splitMode === 'manual' || nextSplitParticipantIds.length !== participantOptions.length);

      return {
        ...current,
        splitMode: shouldUseManualMode ? 'manual' : 'equal',
        splitParticipantIds: nextSplitParticipantIds,
      };
    });
    setErrors((current) => ({ ...current, participants: undefined }));
  };

  const acceptReceiptDraft = (nextDraft: ExpenseReceiptDraft) => {
    if (!tripId) {
      return;
    }
    const previousDraft = receiptDraft;
    if (previousDraft) {
      void cancelExpenseReceiptDraft(tripId, previousDraft.id).catch(() => undefined);
    }
    setScannerVisible(false);
    setEntryMode('manual');
    setReceiptDraft(nextDraft);
    applyReceiptDraft(nextDraft);
  };

  const clearReceiptDraft = async () => {
    if (!tripId || !receiptDraft || receiptBusy) {
      return;
    }
    const draftToCancel = receiptDraft;
    setReceiptDraft(null);
    setReceiptMessage(null);
    setReceiptBusy(true);
    try {
      await cancelExpenseReceiptDraft(tripId, draftToCancel.id);
    } catch {
      setReceiptMessage('영수증 초안을 해제했지만 정리에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setReceiptBusy(false);
    }
  };

  const applyReceiptDraft = (draftToApply: ExpenseReceiptDraft) => {
    const extraction = draftToApply.extraction;
    const warnings: string[] = [];
    const candidateCurrency = extraction.currency ?? currency;
    if (extraction.totalAmountMinor != null) {
      if (candidateCurrency === currency) {
        updateDraft({ amountInput: formatReceiptAmountInput(extraction.totalAmountMinor, currency) });
        setErrors((current) => ({ ...current, amount: undefined }));
      } else {
        warnings.push(`영수증 통화(${candidateCurrency})가 여행 통화(${currency})와 달라 금액은 직접 확인해주세요.`);
      }
    }
    setReceiptMessage(
      [
        `영수증 초안을 채웠어요. 신뢰도 ${receiptConfidenceLabel(extraction.confidence)} · 저장 전 금액/결제자/분할을 확인해주세요.`,
        extraction.warnings[0],
        ...warnings,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  };

  const save = () => {
    const parsedAmount = parseAmountInput(draft.amountInput);
    const nextErrors: QuickExpenseErrors = {};
    if (parsedAmount == null || parsedAmount <= 0) {
      nextErrors.amount = '금액을 입력해주세요.';
    }
    if (!draft.itemId) {
      nextErrors.item = '지출을 연결할 일정을 선택해주세요.';
    }
    if (!draft.payerParticipantId) {
      nextErrors.payer = '결제자를 선택해주세요.';
    }
    if (draft.splitParticipantIds.length === 0) {
      nextErrors.participants = '분할할 사람을 1명 이상 선택해주세요.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsedAmount == null || !draft.itemId || !draft.payerParticipantId) {
      if (nextErrors.amount) {
        amountInputRef.current?.focus();
      } else if (nextErrors.item) {
        setItemSelectorExpanded(true);
      } else if (nextErrors.payer || nextErrors.participants) {
        setActiveSheet('split');
      }
      return;
    }

    onSave({
      amount: parsedAmount,
      currency,
      expenseKind: draft.expenseKind,
      itemId: draft.itemId,
      payerParticipantId: draft.payerParticipantId,
      splitParticipantIds: draft.splitParticipantIds,
      memoInput: draft.memoInput,
      includeInSettlement: draft.includeInSettlement,
      receiptDraftId: receiptDraft?.id ?? null,
    });
  };

  const paymentSplitSummary = buildExpensePaymentSplitSummaryLabel({
    payerParticipantId: draft.payerParticipantId,
    participants: participantOptions.map((participant) => ({
      participantId: participant.id,
      displayName: participant.name,
    })),
    selectedParticipantIds: draft.splitParticipantIds,
    splitPolicy: draft.splitMode,
  });
  const splitErrorMessage = errors.payer ?? errors.participants;
  const settlementSummary = settlementStatusSummaryLabel(draft.includeInSettlement);
  const expenseKindSummary = EXPENSE_KIND_LABELS[draft.expenseKind];
  const handleDirectInput = () => {
    setScannerVisible(false);
    setEntryMode('manual');
  };

  if (entryMode === 'choice' && !receiptDraft) {
    return (
      <>
        <View style={styles.wrap}>
          <Text style={styles.sheetTitle}>지출을 어떻게 입력할까요?</Text>
          <Text style={styles.helperText}>직접 입력하거나 영수증을 촬영해 금액 초안을 채울 수 있어요.</Text>
          <PrimaryButton label="직접 입력" onPress={handleDirectInput} />
          <SecondaryButton disabled={!tripId} label="영수증 촬영" onPress={() => setScannerVisible(true)} />
          {onCancel ? <SecondaryButton label="취소" onPress={onCancel} /> : null}
        </View>
        <ReceiptCaptureScanner
          onClose={() => setScannerVisible(false)}
          onDirectInput={handleDirectInput}
          onDraftCreated={acceptReceiptDraft}
          tripId={tripId ?? ''}
          visible={scannerVisible}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.wrap}>
        <FormField errorText={errors.amount} label="금액">
          <View style={styles.amountField}>
            <TextInput
              accessibilityLabel="금액"
              keyboardType="decimal-pad"
              onChangeText={(amountInput) => updateDraft({ amountInput })}
              placeholder="0"
              ref={amountInputRef}
              placeholderTextColor={theme.color.textFaint}
              style={styles.amountInput}
              value={draft.amountInput}
            />
            <Text style={styles.currencyLabel}>{currencyLabel(currency)}</Text>
          </View>
        </FormField>

        <FormField
          disabled={submitting}
          helperText="영수증을 촬영하면 금액 초안을 채워줘요. 저장 전 직접 확인해야 해요."
          label="영수증"
        >
          <View style={styles.receiptBox}>
            {receiptDraft ? (
              <Text style={styles.helperText}>
                첨부된 초안 · 신뢰도 {receiptConfidenceLabel(receiptDraft.extraction.confidence)}
              </Text>
            ) : null}
            {receiptMessage ? <Text style={styles.helperText}>{receiptMessage}</Text> : null}
            <View style={styles.actionRow}>
              <SecondaryButton
                accessibilityLabel="영수증 다시 촬영"
                disabled={submitting || receiptBusy || !tripId}
                label={receiptDraft ? '다른 영수증 촬영' : '영수증 촬영'}
                onPress={() => setScannerVisible(true)}
                style={styles.receiptActionButton}
              />
              {receiptDraft ? (
                <SecondaryButton
                  accessibilityLabel="영수증 초안 해제"
                  disabled={submitting || receiptBusy}
                  label={receiptBusy ? '해제 중...' : '초안 해제'}
                  onPress={() => void clearReceiptDraft()}
                  style={styles.receiptActionButton}
                />
              ) : null}
            </View>
          </View>
        </FormField>

        <FormField disabled={submitting} errorText={errors.item} label="연결할 일정" required>
          {itemOptions.length === 0 ? (
            <Text style={styles.helperText}>연결할 일정이 없어요.</Text>
          ) : (
            <View style={styles.selectorWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: itemSelectorExpanded }}
                onPress={() => setItemSelectorExpanded((expanded) => !expanded)}
                style={({ pressed }) => [styles.selectorButton, pressed ? styles.pressed : null]}
              >
                <View style={styles.selectorTextColumn}>
                  <Text style={styles.selectorTitle}>{selectedItem?.label ?? '일정을 선택해주세요.'}</Text>
                  {selectedItem?.helper ? (
                    <Text numberOfLines={1} style={styles.selectorHelper}>
                      {selectedItem.helper}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.selectorAction}>{itemSelectorExpanded ? '닫기' : '변경'}</Text>
              </Pressable>
              {itemSelectorExpanded ? (
                <View style={styles.selectorMenu}>
                  {itemOptions.map((item) => {
                    const selected = item.id === draft.itemId;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={item.id}
                        onPress={() => selectItem(item.id)}
                        style={({ pressed }) => [
                          styles.selectorOption,
                          selected ? styles.selectorOptionSelected : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text
                          style={[styles.selectorOptionTitle, selected ? styles.selectorOptionTitleSelected : null]}
                        >
                          {item.label}
                        </Text>
                        {item.helper ? <Text style={styles.selectorHelper}>{item.helper}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )}
        </FormField>

        <SummaryActionRow
          disabled={submitting}
          helper={EXPENSE_KIND_HELPERS[draft.expenseKind]}
          onPress={() => setActiveSheet('kind')}
          title="지출 종류"
          value={expenseKindSummary}
        />

        <SummaryActionRow
          disabled={submitting}
          onPress={() => setActiveSheet('split')}
          title="결제/분할"
          value={paymentSplitSummary}
        />
        {splitErrorMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {splitErrorMessage}
          </Text>
        ) : null}

        <SummaryActionRow
          disabled={submitting}
          helper={draft.includeInSettlement ? undefined : '내역과 총 사용 금액에는 남고 최종 정산에서는 제외돼요.'}
          onPress={() => setActiveSheet('settlement')}
          title="정산 옵션"
          value={settlementSummary}
        />

        <FormField disabled={submitting} label="메모">
          <TextInput
            editable={!submitting}
            multiline
            onChangeText={(memoInput) => updateDraft({ memoInput })}
            placeholder="선택 입력"
            placeholderTextColor={theme.color.textFaint}
            style={[styles.memoInput, styles.textArea]}
            textAlignVertical="top"
            value={draft.memoInput}
          />
        </FormField>
        {errorMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          {onCancel ? <SecondaryButton label="취소" onPress={onCancel} style={styles.cancel} /> : null}
          <PrimaryButton
            disabled={submitting}
            label="저장"
            loading={submitting}
            loadingLabel="저장 중..."
            onPress={save}
            style={styles.saveAction}
          />
        </View>
      </View>

      <BottomSheet onClose={() => setActiveSheet(null)} visible={activeSheet === 'kind'}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>지출 종류</Text>
            <Text style={styles.helperText}>개인/대리 구매는 일반 지출에서 결제자와 분할 대상을 조정해 표현해요.</Text>
          </View>
          <SettlementChoice
            description={EXPENSE_KIND_HELPERS.regular}
            label={EXPENSE_KIND_LABELS.regular}
            onPress={() => selectExpenseKind('regular')}
            selected={draft.expenseKind === 'regular'}
          />
          <SettlementChoice
            description={EXPENSE_KIND_HELPERS.public_fund}
            label={EXPENSE_KIND_LABELS.public_fund}
            onPress={() => selectExpenseKind('public_fund')}
            selected={draft.expenseKind === 'public_fund'}
          />
          <PrimaryButton label="적용" onPress={() => setActiveSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet onClose={() => setActiveSheet(null)} scrollable visible={activeSheet === 'split'}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>결제/분할 설정</Text>
            <Text style={styles.helperText}>
              누가 냈고 누구와 나눌지 설정해요. 나만 선택하면 개인 지출, 결제자와 분할 대상을 다르게 하면 대리 구매예요.
            </Text>
          </View>
          <Text style={styles.label}>결제자</Text>
          <View style={styles.optionList}>
            {participantOptions.map((participant) => {
              const selected = participant.id === draft.payerParticipantId;
              return (
                <ParticipantChip
                  accessibilityLabel={`${participant.name} 결제자${selected ? ' 선택됨' : ' 선택'}`}
                  key={participant.id}
                  color={participant.color}
                  label={participant.name}
                  onPress={() => updateDraft({ payerParticipantId: participant.id })}
                  selected={selected}
                />
              );
            })}
          </View>
          {errors.payer ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {errors.payer}
            </Text>
          ) : null}

          <Text style={styles.label}>분할</Text>
          <SegmentedControl
            disabledOptions={directSplitUnavailableMessage ? [SPLIT_OPTION_LABELS.manual] : []}
            onChange={(value) => {
              const nextSplitMode = value === SPLIT_OPTION_LABELS.equal ? 'equal' : 'manual';
              const selection = selectQuickExpenseSheetSplitMode({
                currentSplitMode: draft.splitMode,
                nextSplitMode,
                participantIds: participantOptions.map((participant) => participant.id),
                selectedSplitParticipantIds: draft.splitParticipantIds,
              });
              if (!selection.ok) {
                setErrors((current) => ({ ...current, participants: selection.message }));
                return;
              }

              updateDraft({ splitMode: selection.splitMode, splitParticipantIds: selection.splitParticipantIds });
              setErrors((current) => ({ ...current, participants: undefined }));
            }}
            options={SPLIT_OPTIONS}
            value={SPLIT_OPTION_LABELS[splitMode]}
          />
          {directSplitUnavailableMessage ? (
            <Text style={styles.helperText}>{directSplitUnavailableMessage}</Text>
          ) : null}
          <View style={styles.optionList}>
            {participantOptions.map((participant) => {
              const selected = draft.splitParticipantIds.includes(participant.id);
              return (
                <ParticipantChip
                  accessibilityLabel={`${participant.name} 분할 대상${selected ? ' 선택됨' : ' 선택'}`}
                  key={participant.id}
                  color={participant.color}
                  label={participant.name}
                  onPress={() => toggleSplitParticipant(participant.id)}
                  selected={selected}
                />
              );
            })}
          </View>
          {errors.participants ? (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {errors.participants}
            </Text>
          ) : null}
          <PrimaryButton label="적용" onPress={() => setActiveSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet onClose={() => setActiveSheet(null)} visible={activeSheet === 'settlement'}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>정산 옵션</Text>
            <Text style={styles.helperText}>현장에서 이미 돈을 주고받은 지출인지 선택해요.</Text>
          </View>
          <SettlementChoice
            description="나중에 여행 정산에서 함께 계산할 지출이에요."
            label="최종 정산에 포함"
            onPress={() => selectSettlementInclusion(true)}
            selected={draft.includeInSettlement}
          />
          <SettlementChoice
            description="이미 돈을 주고받은 지출이에요. 내역과 총 사용 금액에는 남고 최종 정산에서는 제외돼요."
            label="현장 정산 완료"
            onPress={() => selectSettlementInclusion(false)}
            selected={!draft.includeInSettlement}
          />
          <PrimaryButton label="적용" onPress={() => setActiveSheet(null)} />
        </View>
      </BottomSheet>
      <ReceiptCaptureScanner
        onClose={() => setScannerVisible(false)}
        onDirectInput={handleDirectInput}
        onDraftCreated={acceptReceiptDraft}
        tripId={tripId ?? ''}
        visible={scannerVisible}
      />
    </>
  );
}

function SummaryActionRow({
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

function SettlementChoice({
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
  return <SelectableCard checked={selected} description={description} mode="radio" onPress={onPress} title={label} />;
}

function ParticipantChip({
  accessibilityLabel,
  color = theme.color.primary,
  label,
  onPress,
  selected,
}: {
  accessibilityLabel?: string;
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.participantChip,
        selected ? styles.participantChipSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.participantDot, { backgroundColor: color }]}>
        <Text style={styles.participantDotText}>{label.trim().slice(0, 1) || '?'}</Text>
      </View>
      <Text style={[styles.participantName, selected ? styles.participantNameSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replaceAll(',', '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function currencyLabel(currency: string): string {
  if (currency === 'JPY') {
    return '엔';
  }
  if (currency === 'KRW') {
    return '원';
  }
  return currency;
}

function formatReceiptAmountInput(amountMinor: number, currency: string): string {
  if (currency === 'KRW' || currency === 'JPY') {
    return String(amountMinor);
  }
  return (amountMinor / 100).toFixed(2);
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

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[6],
  },
  amountField: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: theme.layout.controlHLg,
    paddingHorizontal: theme.space[5],
  },
  amountInput: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'right',
  },
  cancel: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.lg,
    flex: 1,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  currencyLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  disabled: {
    opacity: 0.55,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    marginTop: theme.space[2],
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  receiptBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  receiptAction: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  receiptActionButton: {
    flex: 1,
  },
  receiptActionText: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.space[3],
    marginTop: theme.space[5],
  },
  memoInput: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  selectorAction: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  selectorButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.controlHLg,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  selectorHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  selectorMenu: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[2],
  },
  selectorOption: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[1],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  selectorOptionSelected: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  selectorOptionTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  selectorOptionTitleSelected: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  selectorTextColumn: {
    flex: 1,
    gap: theme.space[1],
  },
  selectorTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  selectorWrap: {
    gap: theme.space[2],
  },
  sheetContent: {
    gap: theme.space[4],
  },
  sheetHeader: {
    gap: theme.space[1],
  },
  sheetTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  summaryRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
  summaryAction: {
    color: theme.color.primaryTextOnLight,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  participantChip: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[2],
    minHeight: theme.layout.tapMin,
    paddingLeft: theme.space[2],
    paddingRight: theme.space[4],
    paddingVertical: theme.space[2],
  },
  participantChipSelected: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  participantDot: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  participantDotText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
  },
  participantName: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  participantNameSelected: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
  save: {
    alignItems: 'center',
    backgroundColor: theme.color.actionPrimary,
    borderRadius: theme.radius.lg,
    flex: 2,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  saveAction: {
    flex: 2,
  },
  saveText: {
    color: theme.color.onActionPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  textArea: {
    minHeight: 88,
  },
  wrap: {
    paddingBottom: theme.space[3],
  },
});
