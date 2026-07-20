import { StyleSheet, Text, View } from 'react-native';

import { AmountText, Badge, HeroActions, HeroCard, HeroHeader, HeroMetricPanel, theme } from '../design';

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
  const primaryAmountLabel = totalAmountLabel ?? formatHeroAmount(totalAmount, currency);

  return (
    <HeroCard
      variant="panel"
      header={
        <HeroHeader
          body="오늘 쓴 돈만 빠르게 확인해요."
          eyebrow="오늘 지출"
          meta={needsReviewCount > 0 ? <Badge label={`확인 필요 ${needsReviewCount}`} tone="amber" /> : null}
          title="금액만 확인하면 끝."
        />
      }
    >
      <HeroMetricPanel label="오늘 총 지출" value={primaryAmountLabel} />
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
      <HeroActions primary={{ label: addLabel, onPress: onPressAdd, tone: 'lime' }} />
    </HeroCard>
  );
}

function formatHeroAmount(value: number, currency: 'KRW' | 'JPY' | string): string {
  const suffix = currency === 'KRW' ? '원' : currency === 'JPY' ? '엔' : '';
  return `${Math.abs(Math.round(value)).toLocaleString('ko-KR')}${suffix}`;
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
});
