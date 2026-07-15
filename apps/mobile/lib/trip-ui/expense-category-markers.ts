import { theme } from '../design/theme';

export const expenseCategoryValues = ['cafe', 'etc', 'food', 'lodging', 'shopping', 'sights', 'transport'] as const;

export type ExpenseCategory = (typeof expenseCategoryValues)[number];
export type ExpenseCategoryMarkerIconName =
  | 'bed'
  | 'coffee'
  | 'landmark'
  | 'map-pin'
  | 'shopping-bag'
  | 'train-front'
  | 'utensils';

export type ExpenseCategoryMarkerMeta = {
  color: string;
  iconName: ExpenseCategoryMarkerIconName;
  label: string;
};

const EXPENSE_CATEGORY_MARKER_META: Record<ExpenseCategory, ExpenseCategoryMarkerMeta> = {
  cafe: { color: theme.placeType.cafe.color, iconName: 'coffee', label: theme.placeType.cafe.label },
  etc: { color: theme.placeType.etc.color, iconName: 'map-pin', label: theme.placeType.etc.label },
  food: { color: theme.placeType.food.color, iconName: 'utensils', label: theme.placeType.food.label },
  lodging: { color: theme.placeType.lodging.color, iconName: 'bed', label: theme.placeType.lodging.label },
  shopping: { color: theme.placeType.shopping.color, iconName: 'shopping-bag', label: theme.placeType.shopping.label },
  sights: { color: theme.placeType.sights.color, iconName: 'landmark', label: theme.placeType.sights.label },
  transport: {
    color: theme.placeType.transport.color,
    iconName: 'train-front',
    label: theme.placeType.transport.label,
  },
};

export function getExpenseCategoryMarkerMeta(category: ExpenseCategory): ExpenseCategoryMarkerMeta {
  return EXPENSE_CATEGORY_MARKER_META[category];
}
