import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ListTripExpensesResponse } from '@i-um/api-contract';

import { FilterChip, IconButton, InlineAction, SecondaryButton, TextLink, theme } from '../../../../lib/design';
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
import {
  EXPENSE_SEARCH_QUERY_MAX_LENGTH,
  buildExpenseSearchEmptyState,
  buildExpenseSearchStatus,
  hasTripExpenseRows,
  normalizeTripExpenseSearchQuery,
} from '../../../../lib/trips/expense-search';
import {
  resolveTripExpensesRouteState,
  tripExpensesStatePath,
  type TripExpensesRouteMode,
  type TripExpensesRouteState,
} from '../../../../lib/trips/routes';
import { buildQuickExpenseRoute } from '../../../../lib/trips/quick-expense';
import { localDateString } from '../../../../lib/trips/status';
import { buildTripRootFabLayout, shouldShowTripRootFab } from '../../../../lib/trips/trip-root-fab-layout';
import { resolveTripShellDetail } from '../../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../../lib/trips/trip-shell-context';

type TripExpensesState =
  | { status: 'loading' }
  | { status: 'ready'; response: ListTripExpensesResponse }
  | { status: 'auth' }
  | { status: 'notFound' }
  | { status: 'error' };

export default function TripExpensesTabScreen() {
  const {
    tripId: tripIdParam,
    mode: modeParam,
    dayId: dayIdParam,
    category: categoryParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    mode?: string | string[];
    dayId?: string | string[];
    category?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const expenseRouteState = resolveTripExpensesRouteState({
    category: categoryParam,
    dayId: dayIdParam,
    mode: modeParam,
  });
  const shellState = useTripShellState();
  const [state, setState] = useState<TripExpensesState>({ status: 'loading' });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const requestSeq = useRef(0);
  const stateStatusRef = useRef<TripExpensesState['status']>('loading');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    stateStatusRef.current = state.status;
  }, [state.status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(normalizeTripExpenseSearchQuery(searchInput));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const submitSearch = useCallback(() => {
    setDebouncedSearchQuery(normalizeTripExpenseSearchQuery(searchInput));
    Keyboard.dismiss();
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setDebouncedSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const load = useCallback(async () => {
    if (!tripId) {
      setIsSearching(false);
      setState({ status: 'notFound' });
      return;
    }

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setIsSearching(false);
      setState(expenseShellFailureState(shellDetail.status));
      return;
    }

    const requestID = requestSeq.current + 1;
    requestSeq.current = requestID;
    setIsSearching(stateStatusRef.current === 'ready');
    setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    try {
      const response = await listTripExpenses(tripId, debouncedSearchQuery);
      if (requestSeq.current === requestID) {
        setState({ status: 'ready', response });
        setIsSearching(false);
      }
    } catch {
      if (requestSeq.current === requestID) {
        setState({ status: 'error' });
        setIsSearching(false);
      }
    }
  }, [debouncedSearchQuery, shellState, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateExpenseRouteState = useCallback(
    (next: Partial<TripExpensesRouteState>) => {
      if (!tripId) {
        return;
      }
      router.replace(tripExpensesStatePath(tripId, { ...expenseRouteState, ...next }));
    },
    [expenseRouteState, tripId],
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
            mode={expenseRouteState.mode}
            onBack={() => updateExpenseRouteState({ mode: 'main', selectedCategory: null, selectedDayId: null })}
            isSearching={isSearching}
            onCategorySelect={(category) =>
              updateExpenseRouteState({ mode: 'categories', selectedCategory: category, selectedDayId: null })
            }
            onClearSearch={clearSearch}
            onDaySelect={(dayId) =>
              updateExpenseRouteState({ mode: 'days', selectedCategory: null, selectedDayId: dayId })
            }
            onOpenCategories={() => updateExpenseRouteState({ mode: 'categories', selectedDayId: null })}
            onOpenDays={() => updateExpenseRouteState({ mode: 'days', selectedCategory: null })}
            onSearchInputChange={setSearchInput}
            onSubmitSearch={submitSearch}
            response={state.response}
            searchInput={searchInput}
            searchQuery={debouncedSearchQuery}
            selectedCategory={expenseRouteState.selectedCategory}
            selectedDayId={expenseRouteState.selectedDayId}
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
  isSearching,
  mode,
  onBack,
  onCategorySelect,
  onClearSearch,
  onDaySelect,
  onOpenCategories,
  onOpenDays,
  onSearchInputChange,
  onSubmitSearch,
  response,
  searchInput,
  searchQuery,
  selectedCategory,
  selectedDayId,
  tripDays,
  tripId,
}: {
  tripId: string;
  tripDays: Parameters<typeof buildExpenseDashboardViewModel>[0]['days'];
  response: ListTripExpensesResponse;
  mode: TripExpensesRouteMode;
  selectedDayId: string | null;
  selectedCategory: string | null;
  searchInput: string;
  searchQuery: string;
  isSearching: boolean;
  onOpenDays: () => void;
  onOpenCategories: () => void;
  onBack: () => void;
  onClearSearch: () => void;
  onSearchInputChange: (value: string) => void;
  onSubmitSearch: () => void;
  onDaySelect: (dayId: string) => void;
  onCategorySelect: (category: string) => void;
}) {
  const hasRows = hasTripExpenseRows(response);
  const searchCard = (
    <ExpenseSearchCard
      activeQuery={searchQuery}
      hasResults={hasRows}
      isSearching={isSearching}
      onChange={onSearchInputChange}
      onClear={onClearSearch}
      onSubmit={onSubmitSearch}
      query={searchInput}
    />
  );
  if (searchQuery && !isSearching && !hasRows) {
    const emptyState = buildExpenseSearchEmptyState(searchQuery);
    return (
      <>
        {searchCard}
        <TripStateCard helper={emptyState.helper} title={emptyState.title} />
      </>
    );
  }

  if (mode === 'days') {
    const viewModel = buildExpenseDayBrowserViewModel({
      tripId,
      days: tripDays,
      response,
      selectedSectionId: selectedDayId,
    });
    return (
      <>
        {searchCard}
        <ExpenseDayBrowserContent onBack={onBack} onSelectDay={onDaySelect} viewModel={viewModel} />
      </>
    );
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
    return (
      <>
        {searchCard}
        <ExpenseCategoryBrowserContent onBack={onBack} onSelectCategory={onCategorySelect} viewModel={viewModel} />
      </>
    );
  }

  const viewModel = buildExpenseDashboardViewModel({ tripId, days: tripDays, response });
  return (
    <>
      {searchCard}
      <ExpenseDashboardContent onOpenCategories={onOpenCategories} onOpenDays={onOpenDays} viewModel={viewModel} />
    </>
  );
}

function ExpenseSearchCard({
  activeQuery,
  hasResults,
  isSearching,
  onChange,
  onClear,
  onSubmit,
  query,
}: {
  query: string;
  activeQuery: string;
  hasResults: boolean;
  isSearching: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const status = buildExpenseSearchStatus({ hasResults, isSearching, query: activeQuery });

  return (
    <TripListCard>
      <View style={styles.searchCard}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.sectionTitle}>지출 검색</Text>
          <Text style={styles.sectionHelper}>제목, 장소, 메모, 영수증 품목까지 찾아요.</Text>
        </View>
        <View style={styles.searchInputRow}>
          <SearchIcon color={theme.color.textMuted} size={18} strokeWidth={2.4} />
          <TextInput
            accessibilityHint="입력한 검색어로 지출 목록을 필터링합니다."
            accessibilityLabel="지출 검색어"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={EXPENSE_SEARCH_QUERY_MAX_LENGTH}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder="라멘, 택시, 숙소 검색"
            placeholderTextColor={theme.color.textFaint}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {isSearching ? <ActivityIndicator color={theme.color.primary} size="small" /> : null}
          {query ? (
            <IconButton
              accessibilityLabel="검색어 지우기"
              onPress={onClear}
              style={styles.searchClearButton}
              variant="plain"
            >
              <X color={theme.color.textMuted} size={17} strokeWidth={2.5} />
            </IconButton>
          ) : null}
        </View>
        {status ? (
          <View accessibilityLiveRegion="polite" style={styles.searchStatusRow}>
            <Text style={styles.searchStatusLabel}>{status.label}</Text>
            <Text style={styles.searchStatusHelper}>{status.helper}</Text>
          </View>
        ) : null}
      </View>
    </TripListCard>
  );
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
  searchCard: {
    gap: theme.space[4],
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  searchClearButton: {
    backgroundColor: theme.color.surfaceSunken,
  },
  searchInput: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  searchInputRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.controlH,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[2],
    ...theme.shadow.xs,
  },
  searchStatusHelper: {
    color: theme.color.textMuted,
    flex: 1,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
  },
  searchStatusLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  searchStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    minHeight: theme.layout.tapMin,
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
