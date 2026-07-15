import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountText, Badge, theme } from '../design';

const CATEGORY = {
  cafe: { color: theme.color.amber[600], glyph: '카' },
  etc: { color: theme.color.ink[500], glyph: '기' },
  food: { color: theme.color.red[500], glyph: '식' },
  shopping: { color: theme.placeType.shopping.color, glyph: '쇼' },
  sights: { color: theme.color.green[500], glyph: '관' },
  transit: { color: theme.color.blue[500], glyph: '교' },
} as const;

export type ExpenseCategory = keyof typeof CATEGORY;

export type ExpenseRowProps = {
  title: string;
  accessibilityLabel?: string;
  category?: ExpenseCategory;
  payerLabel: string;
  splitLabel?: string;
  amount: number;
  currency?: 'KRW' | 'JPY' | string;
  needsReview?: boolean;
  settlementLabel?: string | null;
  onPress?: () => void;
  first?: boolean;
};

export function ExpenseRow({
  accessibilityLabel,
  amount,
  category = 'etc',
  currency = 'JPY',
  first = false,
  needsReview = false,
  onPress,
  payerLabel,
  settlementLabel = null,
  splitLabel = '전체 1/N',
  title,
}: ExpenseRowProps) {
  const content = (
    <ExpenseRowContent
      amount={amount}
      category={category}
      currency={currency}
      needsReview={needsReview}
      payerLabel={payerLabel}
      settlementLabel={settlementLabel}
      splitLabel={splitLabel}
      title={title}
    />
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.row, first ? null : styles.divider, pressed ? styles.pressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, first ? null : styles.divider]}>{content}</View>;
}

function ExpenseRowContent({
  amount,
  category,
  currency,
  needsReview,
  payerLabel,
  settlementLabel,
  splitLabel,
  title,
}: {
  title: string;
  category: ExpenseCategory;
  payerLabel: string;
  splitLabel: string;
  amount: number;
  currency: string;
  needsReview: boolean;
  settlementLabel: string | null;
}) {
  const categoryMeta = CATEGORY[category] ?? CATEGORY.etc;

  return (
    <>
      <View style={[styles.icon, { backgroundColor: categoryMeta.color }]}>
        <Text style={styles.iconText}>{categoryMeta.glyph}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.meta}>
            {payerLabel} · {splitLabel}
          </Text>
          {settlementLabel ? <Badge label={settlementLabel} tone="neutral" /> : null}
          {needsReview ? <Badge label="확인 필요" tone="amber" /> : null}
        </View>
      </View>
      <AmountText currency={currency} size="md" value={amount} />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: theme.space[1],
  },
  divider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  icon: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  iconText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  meta: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[2],
  },
  pressed: {
    opacity: 0.72,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[4],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
});
