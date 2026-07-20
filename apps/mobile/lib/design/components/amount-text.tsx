import { StyleSheet, Text, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';

import { buildResponsiveLineHeight } from '../responsive-text';
import { theme } from '../theme';

type AmountTone = 'credit' | 'debit' | 'neutral';
type AmountSize = 'sm' | 'md' | 'lg' | 'xl';

const AMOUNT_SIZE: Record<AmountSize, number> = {
  sm: theme.font.size.caption,
  md: theme.font.size.body,
  lg: theme.font.size.headline,
  xl: theme.font.size.titleLg,
};

const CURRENCY_SUFFIX: Record<string, string> = {
  JPY: '엔',
  KRW: '원',
};

export function formatAmountText({
  currency = 'KRW',
  tone = 'neutral',
  value,
}: {
  value: number;
  currency?: 'KRW' | 'JPY' | string;
  tone?: AmountTone;
}): string {
  const sign = tone === 'credit' ? '+' : tone === 'debit' ? '−' : '';
  const amount = Math.abs(Math.round(value)).toLocaleString('ko-KR');
  const suffix = CURRENCY_SUFFIX[currency] ?? '';

  return `${sign}${amount}${suffix}`;
}

export function AmountText({
  accessibilityLabel,
  currency = 'KRW',
  size = 'md',
  style,
  tone = 'neutral',
  value,
}: {
  value: number;
  currency?: 'KRW' | 'JPY' | string;
  tone?: AmountTone;
  size?: AmountSize;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const color = tone === 'credit' ? theme.color.credit : tone === 'debit' ? theme.color.debit : theme.color.textStrong;
  const label = formatAmountText({ currency, tone, value });
  const fontSize = AMOUNT_SIZE[size];
  const lineHeight = buildResponsiveLineHeight({ fontSize, fontScale, leading: theme.font.leading.tight });

  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.amount, { color, fontSize, lineHeight }, style]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: {
    flexShrink: 0,
    fontFamily: theme.font.family.bold,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.3,
  },
});
