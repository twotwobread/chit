import { StyleSheet, Text, View } from 'react-native';

import { AmountText, theme } from '../design';

export type SettlementBalanceCardProps = {
  netAmount: number;
  paidAmount: number;
  shareAmount: number;
  currency?: 'KRW' | 'JPY' | string;
};

export function SettlementBalanceCard({
  currency = 'JPY',
  netAmount,
  paidAmount,
  shareAmount,
}: SettlementBalanceCardProps) {
  const summary = netAmount > 0 ? '받을 금액' : netAmount < 0 ? '보낼 금액' : '정산 완료';

  return (
    <View style={styles.card}>
      <Text style={styles.overline}>내 정산 잔액</Text>
      <View style={styles.amountRow}>
        <Text style={styles.summary}>{summary}</Text>
        <AmountText currency={currency} size="xl" value={Math.abs(netAmount)} style={styles.amountOnDark} />
      </View>
      <View style={styles.divider} />
      <View style={styles.stats}>
        <SettlementStat currency={currency} label="내가 낸 금액" value={paidAmount} />
        <SettlementStat currency={currency} label="내 몫" value={shareAmount} />
      </View>
    </View>
  );
}

function SettlementStat({ currency, label, value }: { currency: string; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <AmountText currency={currency} size="md" value={value} style={styles.amountOnDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  amountOnDark: {
    color: theme.color.onPrimary,
  },
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
    marginTop: theme.space[3],
  },
  card: {
    backgroundColor: theme.color.green[900],
    borderRadius: theme.radius['2xl'],
    padding: theme.space[6],
    width: '100%',
    ...theme.shadow.lg,
  },
  divider: {
    backgroundColor: theme.color.green[800],
    height: 1,
    marginVertical: theme.space[4],
  },
  overline: {
    color: theme.color.green[200],
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.2,
  },
  stat: {
    flex: 1,
    gap: theme.space[1],
  },
  statLabel: {
    color: theme.color.green[200],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.space[6],
  },
  summary: {
    color: theme.color.green[100],
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
});
