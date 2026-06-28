import { StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';

import { AmountText, Avatar, theme } from '../design';

export type TransferRowProps = {
  fromName: string;
  toName: string;
  amount: number;
  currency?: 'KRW' | 'JPY' | string;
  fromColor?: string;
  toColor?: string;
};

export function TransferRow({ amount, currency = 'JPY', fromColor, fromName, toColor, toName }: TransferRowProps) {
  return (
    <View style={styles.row}>
      <Avatar color={fromColor} name={fromName} size={32} />
      <View style={styles.names}>
        <Text numberOfLines={1} style={styles.name}>
          {fromName}
        </Text>
        <ArrowRight color={theme.color.primary} size={18} strokeWidth={2.4} />
        <Text numberOfLines={1} style={styles.name}>
          {toName}
        </Text>
      </View>
      <Avatar color={toColor} name={toName} size={32} />
      <View style={styles.amount}>
        <AmountText currency={currency} size="md" value={amount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    alignItems: 'flex-end',
    flex: 1,
  },
  name: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
    maxWidth: 72,
  },
  names: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  row: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    ...theme.shadow.sm,
  },
});
