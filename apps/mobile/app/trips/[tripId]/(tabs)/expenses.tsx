import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ListTripExpensesResponse } from '@i-um/api-contract';

import { FilterChip, InlineAction, SecondaryButton, TextLink, theme } from '../../../../lib/design';
import { ExpenseRow } from '../../../../lib/trip-ui/ExpenseRow';
import { TripRootFab } from '../../../../lib/trip-ui/TripRootFab';
import { TripListCard, TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { listTripExpenses } from '../../../../lib/trips/expense-api';
import {
  buildExpenseCategoryBrowserViewModel,
  buildExpenseDashboardViewModel,
  buildExpenseDayBrowserViewModel,
  type ExpenseBrowserRowViewModel,
  type ExpenseCategoryBrowserViewModel,
  type ExpenseDashboardCategorySectionViewModel,
  type ExpenseDashboardViewModel,
  type ExpenseDayBrowserViewModel,
  tripExpenseBucketId,
} from '../../../../lib/trips/expense-dashboard';
import { buildQuickExpenseRoute } from '../../../../lib/trips/quick-expense';
import { localDateString } from '../../../../lib/trips/status';
import { buildTripRootFabLayout, shouldShowTripRootFab } from '../../../../lib/trips/trip-root-fab-layout';
import { resolveTripShellDetail } from '../../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../../lib/trips/trip-shell-context';

type ExpenseTabMode = 'main' | 'days' | 'categories';

type TripExpensesState =
  | { status: 'loading' }
  | { status: 'ready'; response: ListTripExpensesResponse }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripExpensesTabScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
  const [state, setState] = useState<TripExpensesState>({ status: 'loading' });
  const [mode, setMode] = useState<ExpenseTabMode>('main');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    if (!tripId) {
      setState({ status: 'notFound' });
      return;
    }

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setState(expenseShellFailureState(shellDetail.status));
      return;
    }

    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', response: await listTripExpenses(tripId) });
    } catch {
      setState({ status: 'error' });
    }
  }, [shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const shellDetail = tripId ? resolveTripShellDetail(shellState, tripId) : { status: 'notFound' as const };
  const detail = shellDetail.status === 'success' ? shellDetail.detail : null;
  const expenseEntryRoute = tripId && detail ? buildExpenseEntryRoute(tripId, detail.days) : null;
  const fabLayout = buildTripRootFabLayout({ bottomInset: insets.bottom, rightInset: insets.right });
  const showFab = shouldShowTripRootFab({
    hasAction: Boolean(expenseEntryRoute),
    isBlocked: false,
    status: state.status === 'ready' ? 'ready' : state.status,
  });

  return (
    <View style={styles.root}>
      <TripScreen contentContainerStyle={showFab ? fabLayout.scrollContent : undefined}>
        {state.status === 'loading' ? <TripStateCard loading title="지출을 불러오는 중..." /> : null}
        {state.status === 'auth' ? (
          <TripStateCard
            primaryAction={{ label: '로그인하기', onPress: () => router.replace('/login') }}
            title="다시 로그인해주세요."
          />
        ) : null}
        {state.status === 'notFound' ? (
          <TripStateCard
            helper="삭제되었거나 접근할 수 없는 여행이에요."
            primaryAction={{ label: '홈으로', onPress: () => router.replace('/') }}
            title="여행을 찾을 수 없어요."
          />
        ) : null}
        {state.status === 'error' ? (
          <TripStateCard
            helper="잠시 후 다시 시도해주세요."
            primaryAction={{ label: '다시 시도', onPress: () => void load() }}
            title="지출을 불러올 수 없어요."
          />
        ) : null}
        {state.status === 'ready' && detail ? (
          <ExpenseContent
            mode={mode}
            onBack={() => setMode('main')}
            onCategorySelect={setSelectedCategory}
            onDaySelect={setSelectedDayId}
            onOpenCategories={() => setMode('categories')}
            onOpenDays={() => setMode('days')}
            response={state.response}
            selectedCategory={selectedCategory}
            selectedDayId={selectedDayId}
            tripDays={detail.days}
            tripId={tripId ?? ''}
          />
        ) : null}
      </TripScreen>
      {showFab && expenseEntryRoute ? (
        <TripRootFab
          accessibilityHint="선택한 여행의 지출 등록 방식을 선택합니다."
          accessibilityLabel="지출 추가"
          layout={fabLayout.fab}
          onPress={() => router.push(expenseEntryRoute)}
        />
      ) : null}
    </View>
  );
}

function ExpenseContent({
  mode,
  onBack,
  onCategorySelect,
  onDaySelect,
  onOpenCategories,
  onOpenDays,
  response,
  selectedCategory,
  selectedDayId,
  tripDays,
  tripId,
}: {
  tripId: string;
  tripDays: Parameters<typeof buildExpenseDashboardViewModel>[0]['days'];
  response: ListTripExpensesResponse;
  mode: ExpenseTabMode;
  selectedDayId: string | null;
  selectedCategory: string | null;
  onOpenDays: () => void;
  onOpenCategories: () => void;
  onBack: () => void;
  onDaySelect: (dayId: string) => void;
  onCategorySelect: (category: string) => void;
}) {
  if (mode === 'days') {
    const viewModel = buildExpenseDayBrowserViewModel({
      tripId,
      days: tripDays,
      response,
      selectedSectionId: selectedDayId,
    });
    return <ExpenseDayBrowserContent onBack={onBack} onSelectDay={onDaySelect} viewModel={viewModel} />;
  }

  if (mode === 'categories') {
    const viewModel = buildExpenseCategoryBrowserViewModel({
      tripId,
      days: tripDays,
      response,
      selectedCategory: selectedCategory as Parameters<
        typeof buildExpenseCategoryBrowserViewModel
      >[0]['selectedCategory'],
    });
    return <ExpenseCategoryBrowserContent onBack={onBack} onSelectCategory={onCategorySelect} viewModel={viewModel} />;
  }

  const viewModel = buildExpenseDashboardViewModel({ tripId, days: tripDays, response });
  return <ExpenseDashboardContent onOpenCategories={onOpenCategories} onOpenDays={onOpenDays} viewModel={viewModel} />;
}

function ExpenseDashboardContent({
  onOpenCategories,
  onOpenDays,
  viewModel,
}: {
  viewModel: ExpenseDashboardViewModel;
  onOpenDays: () => void;
  onOpenCategories: () => void;
}) {
  if (viewModel.status === 'empty') {
    return (
      <>
        <TripStateCard helper={viewModel.helper} title={viewModel.emptyTitle} />
      </>
    );
  }

  return (
    <>
      <ExpenseTotalCard viewModel={viewModel} />
      <ExpenseCategorySummaryCard categorySections={viewModel.categorySections} onOpenCategories={onOpenCategories} />
      <ExpenseRowsCard
        actionLabel="일자별 보기"
        emptyTitle="최근 지출이 없어요."
        onAction={onOpenDays}
        rows={viewModel.recentRows}
        title="최근 지출"
      />
    </>
  );
}

function ExpenseTotalCard({ viewModel }: { viewModel: Extract<ExpenseDashboardViewModel, { status: 'success' }> }) {
  return (
    <TripListCard>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>총 지출</Text>
        <Text style={styles.sectionHelper}>통화별로 환산 없이 따로 보여줘요.</Text>
      </View>
      <View style={styles.totalSectionList}>
        {viewModel.totalSections.map((section) => (
          <View key={section.currency} style={styles.totalSection}>
            <View style={styles.totalHeaderRow}>
              <Text style={styles.totalCurrency}>{section.currency}</Text>
              <Text style={styles.totalAmount}>{section.totalAmountLabel}</Text>
            </View>
            <View style={styles.metricRow}>
              <Metric label="정산 포함" value={section.includedAmountLabel} />
              <Metric label="정산 제외" value={section.excludedCountLabel} />
            </View>
          </View>
        ))}
      </View>
    </TripListCard>
  );
}

function ExpenseCategorySummaryCard({
  categorySections,
  onOpenCategories,
}: {
  categorySections: ExpenseDashboardCategorySectionViewModel[];
  onOpenCategories: () => void;
}) {
  return (
    <TripListCard>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.sectionTitle}>카테고리별 사용</Text>
          <Text style={styles.sectionHelper}>어디에 많이 썼는지 확인해요.</Text>
        </View>
        <TextLink label="전체 보기" onPress={onOpenCategories} tone="strong" />
      </View>
      {categorySections.map((section) => (
        <View key={section.currency} style={styles.categorySection}>
          <View style={styles.totalHeaderRow}>
            <Text style={styles.totalCurrency}>{section.currency}</Text>
            <Text style={styles.categorySectionTotal}>{section.totalAmountLabel}</Text>
          </View>
          <View style={styles.categoryBar}>
            {section.rows.map((row) => (
              <View
                accessibilityLabel={row.accessibilityLabel}
                accessible
                key={row.category}
                style={[
                  styles.categoryBarSegment,
                  { backgroundColor: row.color, flexGrow: Math.max(row.percentage, 1) },
                ]}
              />
            ))}
          </View>
          <View style={styles.categoryList}>
            {section.rows.slice(0, 4).map((row) => (
              <View key={row.category} style={styles.categoryRow}>
                <View style={[styles.categoryMarker, { backgroundColor: row.color }]} />
                <View style={styles.categoryTextColumn}>
                  <Text style={styles.categoryLabel}>{row.label}</Text>
                  <Text style={styles.sectionHelper}>
                    {row.expenseCountLabel} · {row.percentageLabel}
                  </Text>
                </View>
                <Text style={styles.categoryAmount}>{row.amountLabel}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </TripListCard>
  );
}

function ExpenseDayBrowserContent({
  onBack,
  onSelectDay,
  viewModel,
}: {
  viewModel: ExpenseDayBrowserViewModel;
  onBack: () => void;
  onSelectDay: (dayId: string) => void;
}) {
  if (viewModel.status === 'empty') {
    return (
      <TripStateCard
        helper={viewModel.helper}
        primaryAction={{ label: '지출로 돌아가기', onPress: onBack }}
        title={viewModel.emptyTitle}
      />
    );
  }

  return (
    <>
      <SubscreenHeader helper="Day별로 지출을 나눠 확인해요." onBack={onBack} title={viewModel.title} />
      <View style={styles.chipList}>
        {viewModel.sections.map((section) => (
          <FilterChip
            key={section.id}
            label={section.title}
            onPress={() => onSelectDay(section.id)}
            selected={section.id === viewModel.selectedSection.id}
            statusLabel={section.dateLabel ?? (section.id === tripExpenseBucketId ? '기타' : undefined)}
          />
        ))}
      </View>
      <ExpenseRowsCard
        emptyTitle="이 구간에 등록된 지출이 없어요."
        rows={viewModel.selectedSection.rows}
        subtitle={viewModel.selectedSection.statusLabel}
        title={viewModel.selectedSection.title}
      />
    </>
  );
}

function ExpenseCategoryBrowserContent({
  onBack,
  onSelectCategory,
  viewModel,
}: {
  viewModel: ExpenseCategoryBrowserViewModel;
  onBack: () => void;
  onSelectCategory: (category: string) => void;
}) {
  if (viewModel.status === 'empty') {
    return (
      <TripStateCard
        helper={viewModel.helper}
        primaryAction={{ label: '지출로 돌아가기', onPress: onBack }}
        title={viewModel.emptyTitle}
      />
    );
  }

  return (
    <>
      <SubscreenHeader helper="카테고리별로 지출을 필터링해요." onBack={onBack} title={viewModel.title} />
      <View style={styles.chipList}>
        {viewModel.categoryChips.map((chip) => (
          <FilterChip
            key={chip.category}
            label={chip.label}
            onPress={() => onSelectCategory(chip.category)}
            selected={chip.selected}
          />
        ))}
      </View>
      <TripListCard>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>{viewModel.selectedCategorySummary.label}</Text>
          <Text style={styles.sectionHelper}>
            {viewModel.selectedCategorySummary.expenseCountLabel} · {viewModel.selectedCategorySummary.percentageLabel}
          </Text>
        </View>
        <Text style={styles.totalAmount}>{viewModel.selectedCategorySummary.amountLabel}</Text>
      </TripListCard>
      <ExpenseRowsCard emptyTitle="이 카테고리에 등록된 지출이 없어요." rows={viewModel.rows} title="지출 목록" />
    </>
  );
}

function ExpenseRowsCard({
  actionLabel,
  emptyTitle,
  onAction,
  rows,
  subtitle,
  title,
}: {
  title: string;
  subtitle?: string;
  emptyTitle: string;
  rows: ExpenseBrowserRowViewModel[];
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <TripListCard>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionHelper}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onAction ? <InlineAction label={actionLabel} onPress={onAction} /> : null}
      </View>
      {rows.length === 0 ? (
        <View style={styles.emptyRows}>
          <Text style={styles.emptyRowsTitle}>{emptyTitle}</Text>
        </View>
      ) : (
        <View style={styles.expenseList}>
          {rows.map((row, index) => (
            <ExpenseRow
              accessibilityLabel={row.accessibilityLabel}
              amount={row.amountMinor}
              category={row.category}
              currency={row.currency}
              first={index === 0}
              key={row.id}
              onPress={() => router.push(row.editRoute)}
              payerLabel={row.payerLabel}
              settlementLabel={row.settlementLabel}
              splitLabel={`${row.contextLabel} · ${row.splitLabel}`}
              title={row.title}
            />
          ))}
        </View>
      )}
    </TripListCard>
  );
}

function SubscreenHeader({ helper, onBack, title }: { title: string; helper: string; onBack: () => void }) {
  return (
    <View style={styles.subscreenHeader}>
      <SecondaryButton label="지출로 돌아가기" onPress={onBack} />
      <TripScreenHeader helper={helper} title={title} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function buildExpenseEntryRoute(tripId: string, days: Parameters<typeof buildExpenseDashboardViewModel>[0]['days']) {
  const orderedDays = [...days].sort((left, right) => left.dayOrder - right.dayOrder);
  const today = localDateString();
  const entryDay = orderedDays.find((day) => day.date === today) ?? orderedDays[0] ?? null;
  return entryDay ? buildQuickExpenseRoute(tripId, entryDay.id, null, 'expenses') : null;
}

function expenseShellFailureState(status: 'auth' | 'notFound' | 'error'): TripExpensesState {
  if (status === 'error') {
    return { status: 'error' };
  }
  return { status };
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.color.bg,
    flex: 1,
  },
  cardHeader: {
    gap: theme.space[2],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  cardHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  cardHeaderText: {
    flex: 1,
    gap: theme.space[2],
  },
  categoryAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  categoryBar: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.pill,
    flexDirection: 'row',
    height: theme.space[4],
    marginHorizontal: theme.space[5],
    overflow: 'hidden',
  },
  categoryBarSegment: {
    minWidth: 2,
  },
  categoryLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  categoryList: {
    gap: theme.space[3],
    padding: theme.space[5],
    paddingTop: theme.space[4],
  },
  categoryMarker: {
    borderRadius: theme.radius.pill,
    height: theme.space[3],
    width: theme.space[3],
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  categorySection: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    paddingBottom: theme.space[3],
  },
  categorySectionTotal: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  categoryTextColumn: {
    flex: 1,
    gap: theme.space[1],
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  emptyRows: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[6],
  },
  emptyRowsTitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  expenseList: {
    paddingBottom: theme.space[2],
  },
  metricBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    flex: 1,
    gap: theme.space[1],
    minWidth: 112,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  metricLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.micro,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  metricValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  sectionHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  subscreenHeader: {
    gap: theme.space[4],
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  totalAmount: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    paddingHorizontal: theme.space[5],
    paddingBottom: theme.space[5],
  },
  totalCurrency: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  totalHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  totalSection: {
    borderTopColor: theme.color.borderSubtle,
    borderTopWidth: 1,
    gap: theme.space[4],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  totalSectionList: {
    paddingBottom: theme.space[2],
  },
});
