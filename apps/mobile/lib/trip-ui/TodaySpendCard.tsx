import { StyleSheet, Text, View } from 'react-native';

import { AmountText, Badge, PrimaryButton, theme } from '../design';

export type TodaySpendCardProps = {
  totalAmount: number;
  totalAmountLabel?: string;
  currency?: 'KRW' | 'JPY' | string;
  paidByMeAmount?: number;
  needsReviewCount?: number;
  additionalAmountLabels?: string[];
  onPressAdd: () => void;
  addLabel?: string;
};

export function TodaySpendCard({
  addLabel = '지출 등록',
  additionalAmountLabels = [],
  currency = 'JPY',
  needsReviewCount = 0,
  onPressAdd,
  paidByMeAmount,
  totalAmount,
  totalAmountLabel,
}: TodaySpendCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.overline}>오늘 지출</Text>
        {needsReviewCount > 0 ? <Badge label={`확인 필요 ${needsReviewCount}`} tone="amber" /> : null}
      </View>

      <View style={styles.amountRow}>
        {totalAmountLabel ? (
          <Text style={styles.totalAmountLabel}>{totalAmountLabel}</Text>
        ) : (
          <AmountText currency={currency} size="xl" value={totalAmount} />
        )}
        {additionalAmountLabels.length > 0 ? (
          <View style={styles.additionalAmounts}>
            {additionalAmountLabels.map((label) => (
              <Text key={label} style={styles.additionalAmountText}>
                + {label}
              </Text>
            ))}
          </View>
        ) : null}
        {paidByMeAmount == null ? null : (
          <View style={styles.paidByMeRow}>
            <Text style={styles.paidByMeLabel}>내가 낸 금액</Text>
            <AmountText currency={currency} size="sm" value={paidByMeAmount} style={styles.paidByMeAmount} />
          </View>
        )}
      </View>

      <PrimaryButton label={addLabel} onPress={onPressAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  additionalAmounts: {
    gap: theme.space[1],
  },
  additionalAmountText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  amountRow: {
    alignItems: 'flex-start',
    gap: theme.space[2],
  },
  card: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[5],
    width: '100%',
    ...theme.shadow.xs,
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overline: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1,
  },
  paidByMeAmount: {
    color: theme.color.textStrong,
  },
  paidByMeLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  paidByMeRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  totalAmountLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
  },
});
