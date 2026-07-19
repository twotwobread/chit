import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  BedDouble,
  Coffee,
  Landmark,
  MapPin,
  ShoppingBag,
  TrainFront,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';

import { AmountText, Badge, formatAmountText, theme } from '../design';
import {
  type ExpenseCategory,
  type ExpenseCategoryMarkerIconName,
  getExpenseCategoryMarkerMeta,
} from './expense-category-markers';
import { buildExpenseRowLayout, type ExpenseRowLayout } from './expense-row-layout';

export type { ExpenseCategory } from './expense-category-markers';

const CATEGORY_ICON: Record<ExpenseCategoryMarkerIconName, LucideIcon> = {
  bed: BedDouble,
  coffee: Coffee,
  landmark: Landmark,
  'map-pin': MapPin,
  'shopping-bag': ShoppingBag,
  'train-front': TrainFront,
  utensils: Utensils,
};

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
  const { fontScale, width } = useWindowDimensions();
  const layout = buildExpenseRowLayout({ fontScale, width });
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    buildExpenseRowAccessibilityLabel({
      amount,
      currency,
      needsReview,
      payerLabel,
      settlementLabel,
      splitLabel,
      title,
    });
  const content = (
    <ExpenseRowContent
      amount={amount}
      category={category}
      currency={currency}
      layout={layout}
      needsReview={needsReview}
      payerLabel={payerLabel}
      settlementLabel={settlementLabel}
      splitLabel={splitLabel}
      title={title}
    />
  );
  const rowStyle = [
    styles.row,
    { alignItems: layout.rowAlignItems, minHeight: layout.minRowHeight },
    first ? null : styles.divider,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...rowStyle, pressed ? styles.pressed : null]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={resolvedAccessibilityLabel} style={rowStyle}>
      {content}
    </View>
  );
}

function ExpenseRowContent({
  amount,
  category,
  currency,
  layout,
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
  layout: ExpenseRowLayout;
  needsReview: boolean;
  settlementLabel: string | null;
}) {
  const categoryMeta = getExpenseCategoryMarkerMeta(category);
  const CategoryIcon = CATEGORY_ICON[categoryMeta.iconName];
  const amountText = (
    <AmountText
      accessibilityLabel={formatAmountText({ currency, value: amount })}
      currency={currency}
      size="md"
      style={layout.amountPlacement === 'stacked' ? styles.amountStacked : styles.amountTrailing}
      value={amount}
    />
  );
  const badgeRow =
    settlementLabel || needsReview ? (
      <View style={[styles.badgeRow, layout.metaDirection === 'column' ? styles.badgeRowStacked : null]}>
        {settlementLabel ? <Badge accessibilityLabel={settlementLabel} label={settlementLabel} tone="neutral" /> : null}
        {needsReview ? <Badge accessibilityLabel="확인 필요" label="확인 필요" tone="amber" /> : null}
      </View>
    ) : null;

  return (
    <>
      <View
        accessibilityLabel={`${categoryMeta.label} 카테고리`}
        accessible
        style={[styles.icon, { backgroundColor: categoryMeta.color }]}
      >
        <CategoryIcon color={theme.color.surface} size={18} strokeWidth={2.4} />
      </View>
      <View style={styles.body}>
        <Text
          accessibilityLabel={title}
          ellipsizeMode="tail"
          numberOfLines={layout.titleNumberOfLines}
          style={[styles.title, { lineHeight: layout.titleLineHeight }]}
        >
          {title}
        </Text>
        <View style={[styles.metaRow, { flexDirection: layout.metaDirection }]}>
          <Text
            accessibilityLabel={`${payerLabel} · ${splitLabel}`}
            ellipsizeMode="tail"
            numberOfLines={layout.metaNumberOfLines}
            style={[styles.meta, { lineHeight: layout.metaLineHeight }]}
          >
            {payerLabel} · {splitLabel}
          </Text>
          {badgeRow}
        </View>
        {layout.amountPlacement === 'stacked' ? amountText : null}
      </View>
      {layout.amountPlacement === 'trailing' ? amountText : null}
    </>
  );
}

function buildExpenseRowAccessibilityLabel({
  amount,
  currency,
  needsReview,
  payerLabel,
  settlementLabel,
  splitLabel,
  title,
}: {
  title: string;
  payerLabel: string;
  splitLabel: string;
  amount: number;
  currency: string;
  needsReview: boolean;
  settlementLabel: string | null;
}): string {
  return [
    title,
    formatAmountText({ currency, value: amount }),
    payerLabel,
    splitLabel,
    settlementLabel,
    needsReview ? '확인 필요' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const styles = StyleSheet.create({
  amountStacked: {
    alignSelf: 'flex-start',
    marginTop: theme.space[1],
  },
  amountTrailing: {
    alignSelf: 'center',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  badgeRowStacked: {
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    gap: theme.space[1],
    minWidth: 0,
  },
  divider: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
  },
  icon: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  meta: {
    color: theme.color.textMuted,
    flexShrink: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  pressed: {
    backgroundColor: theme.color.surfaceSunken,
  },
  row: {
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
