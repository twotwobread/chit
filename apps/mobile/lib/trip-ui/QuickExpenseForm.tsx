import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SegmentedControl, theme } from '../design';

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
  itemId: string | null;
  payerParticipantId: string | null;
  splitParticipantIds: string[];
};

export type QuickExpenseSubmitPayload = {
  amount: number;
  currency: 'KRW' | 'JPY' | string;
  itemId: string;
  payerParticipantId: string;
  splitParticipantIds: string[];
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
};

type QuickExpenseErrors = Partial<Record<'amount' | 'item' | 'payer' | 'participants', string>>;

const SPLIT_OPTIONS = ['1/N 분할', '직접 분할'];

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
}: QuickExpenseFormProps) {
  const defaultItemId = Object.prototype.hasOwnProperty.call(initialDraft ?? {}, 'itemId')
    ? (initialDraft?.itemId ?? null)
    : (itemOptions[0]?.id ?? null);
  const defaultPayerId = Object.prototype.hasOwnProperty.call(initialDraft ?? {}, 'payerParticipantId')
    ? (initialDraft?.payerParticipantId ?? null)
    : (participantOptions[0]?.id ?? null);
  const defaultSplitIds = initialDraft?.splitParticipantIds ?? participantOptions.map((participant) => participant.id);
  const [draft, setDraft] = useState<QuickExpenseDraft>({
    amountInput: initialDraft?.amountInput ?? '',
    itemId: defaultItemId,
    payerParticipantId: defaultPayerId,
    splitParticipantIds: defaultSplitIds,
  });
  const [errors, setErrors] = useState<QuickExpenseErrors>({});
  const [itemSelectorExpanded, setItemSelectorExpanded] = useState(false);
  const splitMode =
    draft.splitParticipantIds.length === participantOptions.length ? SPLIT_OPTIONS[0] : SPLIT_OPTIONS[1];
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

  const selectItem = (itemId: string) => {
    updateDraft({ itemId });
    setItemSelectorExpanded(false);
  };

  const toggleSplitParticipant = (participantId: string) => {
    setDraft((current) => ({
      ...current,
      splitParticipantIds: current.splitParticipantIds.includes(participantId)
        ? current.splitParticipantIds.filter((id) => id !== participantId)
        : [...current.splitParticipantIds, participantId],
    }));
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
      return;
    }

    onSave({
      amount: parsedAmount,
      currency,
      itemId: draft.itemId,
      payerParticipantId: draft.payerParticipantId,
      splitParticipantIds: draft.splitParticipantIds,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>금액</Text>
      <View style={styles.amountField}>
        <Text style={styles.currencyLabel}>{currencyLabel(currency)}</Text>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={(amountInput) => updateDraft({ amountInput })}
          placeholder="0"
          placeholderTextColor={theme.color.textFaint}
          style={styles.amountInput}
          value={draft.amountInput}
        />
      </View>
      {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

      <Text style={styles.label}>연결할 일정</Text>
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
                    <Text style={[styles.selectorOptionTitle, selected ? styles.selectorOptionTitleSelected : null]}>
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
      {errors.item ? <Text style={styles.errorText}>{errors.item}</Text> : null}

      <Text style={styles.label}>결제자</Text>
      <View style={styles.optionList}>
        {participantOptions.map((participant) => (
          <ParticipantChip
            key={participant.id}
            color={participant.color}
            label={participant.name}
            onPress={() => updateDraft({ payerParticipantId: participant.id })}
            selected={participant.id === draft.payerParticipantId}
          />
        ))}
      </View>
      {errors.payer ? <Text style={styles.errorText}>{errors.payer}</Text> : null}

      <Text style={styles.label}>분할</Text>
      <SegmentedControl
        onChange={(value) => {
          if (value === SPLIT_OPTIONS[0]) {
            updateDraft({ splitParticipantIds: participantOptions.map((participant) => participant.id) });
          }
        }}
        options={SPLIT_OPTIONS}
        value={splitMode}
      />
      <View style={styles.optionList}>
        {participantOptions.map((participant) => (
          <ParticipantChip
            key={participant.id}
            color={participant.color}
            label={participant.name}
            onPress={() => toggleSplitParticipant(participant.id)}
            selected={draft.splitParticipantIds.includes(participant.id)}
          />
        ))}
      </View>
      {errors.participants ? <Text style={styles.errorText}>{errors.participants}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.actionRow}>
        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
          >
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={save}
          style={({ pressed }) => [styles.save, submitting ? styles.disabled : null, pressed ? styles.pressed : null]}
        >
          <Text style={styles.saveText}>{submitting ? '저장 중' : '저장'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ParticipantChip({
  color = theme.color.primary,
  label,
  onPress,
  selected,
}: {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
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
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
    marginBottom: theme.space[3],
    marginTop: theme.space[5],
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  selectorAction: {
    color: theme.color.primary,
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
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  selectorOptionTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  selectorOptionTitleSelected: {
    color: theme.color.primary,
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
  participantChip: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: theme.space[2],
    paddingLeft: theme.space[2],
    paddingRight: theme.space[4],
    paddingVertical: theme.space[2],
  },
  participantChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
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
    color: theme.color.green[800],
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
  save: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    flex: 2,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  saveText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  wrap: {
    paddingBottom: theme.space[3],
  },
});
