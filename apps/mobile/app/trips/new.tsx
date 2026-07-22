import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  DestinationSearchResult,
  SupportedCurrency,
  TripDefaultTravelMode,
  TripDestinationInput,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import {
  ChoiceChip,
  FormField,
  InlineAction,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
  SectionCard,
  SelectableListRow,
  StepWizardHeader,
  TextInputField,
  theme,
} from '../../lib/design';
import {
  addTripDestination,
  buildCreateTripDestinations,
  destinationCountryMismatchConfirmation,
  destinationKey,
  destinationSearchSubmitState,
  destinationSelectionStatus,
  removeTripDestination,
  tripDestinationInputFromSearchResult,
  validateTripDestinations,
} from '../../lib/trips/destinations';
import { createTrip, searchDestinations } from '../../lib/trips/trip-api';
import { ConfirmationModal } from '../../lib/trip-ui/ConfirmationModal';
import { KeyboardAwareFormScrollView } from '../../lib/trip-ui/KeyboardAwareFormScrollView';
import { StickyActionFooter, useStickyActionFooterLayout } from '../../lib/trip-ui/StickyActionFooter';
import { TripDateRangeCalendar } from '../../lib/trip-ui/TripDateRangeCalendar';
import { isValidDate, monthStringFromDate, todayString } from '../../lib/trips/date';
import {
  applySuggestedTripName,
  createTripWizardSteps,
  nextCreateTripWizardStep,
  previousCreateTripWizardStep,
  suggestTripName,
  type CreateTripWizardStep,
} from '../../lib/trips/create-trip-wizard';
import {
  filterPopularTripDestinations,
  popularTripDestinations,
  type PopularDestinationImageKey,
  type PopularTripDestination,
} from '../../lib/trips/popular-destinations';
import { selectTripDateRangeCalendarDate } from '../../lib/trips/trip-date-range-calendar';
import {
  buildTripDefaultTravelModeSelectorViewModel,
  defaultTripTravelMode,
  isTripDefaultTravelMode,
  travelModeDisplayLabel,
} from '../../lib/trips/travel-mode';

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  defaultCurrency: SupportedCurrency;
  defaultTravelMode: TripDefaultTravelMode;
};

const currencies: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];
const yearOptionCount = 10;

const initialForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  defaultCurrency: 'KRW',
  defaultTravelMode: defaultTripTravelMode,
};

const destinationImageSources: Record<PopularDestinationImageKey, ImageSourcePropType> = {
  bangkok: require('../../assets/destinations/bangkok.png'),
  danang: require('../../assets/destinations/danang.png'),
  fukuoka: require('../../assets/destinations/fukuoka.png'),
  jeju: require('../../assets/destinations/jeju.png'),
  okinawa: require('../../assets/destinations/okinawa.png'),
  osaka: require('../../assets/destinations/osaka.png'),
  paris: require('../../assets/destinations/paris.png'),
  sapporo: require('../../assets/destinations/sapporo.png'),
  seoul: require('../../assets/destinations/seoul.png'),
  singapore: require('../../assets/destinations/singapore.png'),
  taipei: require('../../assets/destinations/taipei.png'),
  tokyo: require('../../assets/destinations/tokyo.png'),
};

const stepCopy: Record<CreateTripWizardStep, { label: string }> = {
  destinations: { label: '여행지' },
  dates: { label: '여행기간' },
  settings: { label: '기본 설정' },
  review: { label: '최종 확인' },
};

export default function NewTripScreen() {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(initialForm);
  const [destinations, setDestinations] = useState<TripDestinationInput[]>([]);
  const [wizardStep, setWizardStep] = useState<CreateTripWizardStep>('destinations');
  const [nameEdited, setNameEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationResults, setDestinationResults] = useState<DestinationSearchResult[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationSearched, setDestinationSearched] = useState(false);
  const destinationSearchRequestId = useRef(0);
  const today = todayString();
  const destinationStatus = destinationSelectionStatus(destinations);
  const suggestedName = suggestTripName(destinations, form.startDate, form.endDate);
  const effectiveTripName = applySuggestedTripName(form.name, suggestedName, nameEdited);
  const stepIndex = createTripWizardSteps.indexOf(wizardStep);
  const isFirstStep = wizardStep === 'destinations';
  const isReviewStep = wizardStep === 'review';
  const footerLayout = useStickyActionFooterLayout({ actionCount: 1 });
  const travelModeSelector = buildTripDefaultTravelModeSelectorViewModel(form.defaultTravelMode);
  const scrollContentStyle = [styles.scrollContent, { paddingTop: insets.top + theme.space[4] }];

  const updateDestinationQuery = (query: string) => {
    destinationSearchRequestId.current += 1;
    setDestinationQuery(query);
    setDestinationResults([]);
    setDestinationError(null);
    setDestinationLoading(false);
    setDestinationSearched(false);
  };

  const runDestinationSearch = async () => {
    const query = destinationQuery.trim();
    if (query.length < 2) {
      destinationSearchRequestId.current += 1;
      setDestinationResults([]);
      setDestinationLoading(false);
      setDestinationError(null);
      setDestinationSearched(false);
      return;
    }

    const requestId = destinationSearchRequestId.current + 1;
    destinationSearchRequestId.current = requestId;
    setDestinationLoading(true);
    setDestinationError(null);
    setDestinationSearched(true);
    try {
      const response = await searchDestinations(query);
      if (destinationSearchRequestId.current === requestId) {
        setDestinationResults(response.results);
      }
    } catch {
      if (destinationSearchRequestId.current === requestId) {
        setDestinationResults([]);
        setDestinationError('도시를 검색할 수 없어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      if (destinationSearchRequestId.current === requestId) {
        setDestinationLoading(false);
      }
    }
  };

  const selectDate = (date: string) => {
    setForm((current) => selectTripDateRangeCalendarDate(current, date));
    setCalendarMonth(monthStringFromDate(new Date(`${date}T00:00:00`)));
    setError(null);
  };

  const addDestination = (result: DestinationSearchResult) => {
    setDestinations((current) => addTripDestination(current, tripDestinationInputFromSearchResult(result)));
    setError(null);
  };

  const validateStep = (step: CreateTripWizardStep): string | null => {
    if (step === 'destinations') {
      return validateTripDestinations(destinations);
    }
    if (step === 'dates') {
      return validateDateRange(form, today);
    }
    if (step === 'settings') {
      return validateSettings(form);
    }
    return validateForm(form, today, effectiveTripName) ?? validateTripDestinations(destinations);
  };

  const goNext = () => {
    const validationError = validateStep(wizardStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setWizardStep((current) => nextCreateTripWizardStep(current));
  };

  const goBack = () => {
    setError(null);
    setWizardStep((current) => previousCreateTripWizardStep(current));
  };

  const resetNameToSuggestion = () => {
    setForm((current) => ({ ...current, name: suggestedName }));
    setNameEdited(false);
    setError(null);
  };

  const submit = async () => {
    const resolvedName = effectiveTripName.trim();
    const validationError = validateForm(form, today, resolvedName) ?? validateTripDestinations(destinations);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createTrip({
        name: resolvedName,
        startDate: form.startDate,
        endDate: form.endDate,
        defaultCurrency: form.defaultCurrency,
        defaultTravelMode: form.defaultTravelMode,
        destinations: buildCreateTripDestinations(destinations),
      });
      router.replace('/');
    } catch (submitError) {
      if (
        submitError instanceof MobileAuthError &&
        (submitError.code === 'INVALID_REFRESH_TOKEN' || submitError.code === 'UNAUTHORIZED')
      ) {
        setError('다시 로그인해주세요.');
      } else {
        setError('여행을 만들 수 없어요. 입력 내용을 확인하고 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenBackground style={styles.screenRoot}>
      <KeyboardAwareFormScrollView
        contentContainerStyle={scrollContentStyle}
        keyboardFixedBottomOffset={footerLayout.keyboardFixedBottomOffset}
        keyboardMinClearance={footerLayout.keyboardMinClearance}
        style={styles.scroll}
      >
        <View style={styles.wizardContent}>
          <StepWizardHeader
            backAction={!isFirstStep ? { disabled: submitting, label: '이전', onPress: goBack } : undefined}
            currentStep={stepIndex + 1}
            label={stepCopy[wizardStep].label}
            totalSteps={createTripWizardSteps.length}
          />

          {wizardStep === 'destinations' ? (
            <DestinationStep
              destinationError={destinationError}
              destinationStatus={destinationStatus}
              destinations={destinations}
              loading={destinationLoading}
              onAdd={addDestination}
              onQueryChange={updateDestinationQuery}
              onRemove={(key) => setDestinations((current) => removeTripDestination(current, key))}
              onSearch={() => void runDestinationSearch()}
              query={destinationQuery}
              results={destinationResults}
              searched={destinationSearched}
              submitting={submitting}
            />
          ) : null}

          {wizardStep === 'dates' ? (
            <TripDateRangeCalendar
              calendarMonth={calendarMonth}
              disabled={submitting}
              onMonthChange={setCalendarMonth}
              onSelectDate={selectDate}
              today={today}
              values={form}
              yearOptionCount={yearOptionCount}
            />
          ) : null}

          {wizardStep === 'settings' ? (
            <View style={styles.stepStack}>
              <SectionCard helper="여행 지출 입력의 기본값으로 사용돼요." title="기본 통화">
                <View style={styles.optionRow}>
                  {currencies.map((currency) => {
                    const selected = form.defaultCurrency === currency;
                    return (
                      <ChoiceChip
                        disabled={submitting}
                        key={currency}
                        label={currency}
                        onPress={() => {
                          setForm((current) => ({ ...current, defaultCurrency: currency }));
                          setError(null);
                        }}
                        selected={selected}
                      />
                    );
                  })}
                </View>
              </SectionCard>

              <SectionCard helper="오늘 화면과 일정 이동 시간 계산의 기본 기준이에요." title={travelModeSelector.label}>
                <View style={styles.optionRow}>
                  {travelModeSelector.options.map((option) => (
                    <ChoiceChip
                      accessibilityLabel={option.accessibilityLabel}
                      disabled={submitting}
                      key={option.mode}
                      label={option.label}
                      onPress={() => {
                        setForm((current) => ({ ...current, defaultTravelMode: option.mode }));
                        setError(null);
                      }}
                      selected={option.selected}
                    />
                  ))}
                </View>
                <Text style={styles.inlineHint}>도보는 trip 기본값이 아니라 구간별 확인 옵션으로 유지돼요.</Text>
              </SectionCard>
            </View>
          ) : null}

          {wizardStep === 'review' ? (
            <View style={styles.stepStack}>
              <SectionCard>
                <TextInputField
                  disabled={submitting}
                  helperText="추천 이름을 그대로 쓰거나 원하는 이름으로 바꿀 수 있어요."
                  label="여행 이름"
                  onChangeText={(name) => {
                    setForm((current) => ({ ...current, name }));
                    setNameEdited(true);
                    setError(null);
                  }}
                  placeholder="예: 오사카 3박 4일"
                  required
                  value={effectiveTripName}
                />
                {nameEdited ? (
                  <SecondaryButton
                    disabled={submitting}
                    label="추천 이름으로 다시 채우기"
                    onPress={resetNameToSuggestion}
                  />
                ) : null}
              </SectionCard>

              <SectionCard tone="sunken">
                <SummaryRow
                  label="여행 도시"
                  value={destinations.map((destination) => destination.displayName).join(' · ')}
                />
                <SummaryRow label="여행 기간" value={`${form.startDate} ~ ${form.endDate}`} />
                <SummaryRow label="기본 통화" value={form.defaultCurrency} />
                <SummaryRow label="이동 방식" value={travelModeDisplayLabel(form.defaultTravelMode)} />
              </SectionCard>
            </View>
          ) : null}

          {error ? (
            <SectionCard tone="danger">
              <Text style={styles.errorText}>{error}</Text>
            </SectionCard>
          ) : null}
        </View>
      </KeyboardAwareFormScrollView>
      <StickyActionFooter actionCount={1} layout={footerLayout}>
        <PrimaryButton
          disabled={submitting}
          label={isReviewStep ? '여행 만들기' : '다음'}
          loading={submitting}
          loadingLabel="여행 만드는 중..."
          onPress={isReviewStep ? () => void submit() : goNext}
        />
      </StickyActionFooter>
    </ScreenBackground>
  );
}

type DestinationStepProps = {
  destinationError: string | null;
  destinationStatus: ReturnType<typeof destinationSelectionStatus>;
  destinations: TripDestinationInput[];
  loading: boolean;
  onAdd: (result: DestinationSearchResult) => void;
  onQueryChange: (query: string) => void;
  onRemove: (key: string) => void;
  onSearch: () => void;
  query: string;
  results: DestinationSearchResult[];
  searched: boolean;
  submitting: boolean;
};

function DestinationStep({
  destinationError,
  destinationStatus,
  destinations,
  loading,
  onAdd,
  onQueryChange,
  onRemove,
  onSearch,
  query,
  results,
  searched,
  submitting,
}: DestinationStepProps) {
  return (
    <View style={styles.stepStack}>
      {destinations.length > 0 ? (
        <SectionCard meta={buildDestinationSummary(destinations)} title="선택한 도시">
          <View style={styles.destinationChipRow}>
            {destinations.map((destination, index) => (
              <InlineAction
                accessibilityLabel={`${destination.displayName} 도시 삭제`}
                disabled={submitting}
                key={destinationKey(destination)}
                label={`${destination.displayName}${index === 0 ? '  대표' : ''}`}
                onPress={() => onRemove(destinationKey(destination))}
                tone="primary"
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <InlineDestinationSearchPanel
        destinations={destinations}
        error={destinationError}
        loading={loading}
        onAdd={onAdd}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        query={query}
        results={results}
        searched={searched}
      />

      {destinationStatus.helperText ? (
        <SectionCard tone="notice">
          <Text style={styles.helperText}>{destinationStatus.helperText}</Text>
        </SectionCard>
      ) : null}
    </View>
  );
}

type InlineDestinationSearchPanelProps = {
  destinations: TripDestinationInput[];
  error: string | null;
  loading: boolean;
  onAdd: (result: DestinationSearchResult) => void;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  query: string;
  results: DestinationSearchResult[];
  searched: boolean;
};

function InlineDestinationSearchPanel({
  destinations,
  error,
  loading,
  onAdd,
  onQueryChange,
  onSearch,
  query,
  results,
  searched,
}: InlineDestinationSearchPanelProps) {
  const selectedKeys = new Set(destinations.map(destinationKey));
  const status = destinationSelectionStatus(destinations);
  const searchSubmitState = destinationSearchSubmitState(query, loading);
  const trimmedQuery = searchSubmitState.query;
  const popularMatches = filterPopularTripDestinations(
    query,
    trimmedQuery.length > 0 ? 8 : Math.min(7, popularTripDestinations.length),
  );
  const [pendingCountryMismatchResult, setPendingCountryMismatchResult] = useState<DestinationSearchResult | null>(
    null,
  );
  const pendingCountryMismatchDestination = pendingCountryMismatchResult
    ? tripDestinationInputFromSearchResult(pendingCountryMismatchResult)
    : null;
  const pendingCountryMismatchConfirmation = pendingCountryMismatchDestination
    ? destinationCountryMismatchConfirmation(destinations, pendingCountryMismatchDestination)
    : null;
  const shouldShowServerResults = loading || searched || Boolean(error) || trimmedQuery.length >= 2;

  const requestAddResult = (result: DestinationSearchResult) => {
    const destination = tripDestinationInputFromSearchResult(result);
    const confirmation = destinationCountryMismatchConfirmation(destinations, destination);
    if (confirmation) {
      setPendingCountryMismatchResult(result);
      return;
    }
    setPendingCountryMismatchResult(null);
    onAdd(result);
  };

  const confirmCountryMismatchAdd = () => {
    if (!pendingCountryMismatchResult) {
      return;
    }
    const result = pendingCountryMismatchResult;
    setPendingCountryMismatchResult(null);
    onAdd(result);
  };

  return (
    <View style={styles.searchPanel}>
      <SectionCard>
        <FormField
          label="도시 검색"
          helperText="인기 도시는 바로 추가하고, 더 찾고 싶으면 검색해요."
          errorText={error ?? undefined}
        >
          <View style={styles.searchPanelHeader}>
            <View style={styles.searchCountBadge}>
              <Text style={styles.searchCountText}>{destinations.length}/5</Text>
            </View>
          </View>
          <View style={styles.destinationSearchRow}>
            <TextInput
              editable={!loading}
              onChangeText={onQueryChange}
              onSubmitEditing={() => {
                if (searchSubmitState.canSearch) {
                  onSearch();
                }
              }}
              placeholder="예: 오사카"
              placeholderTextColor={theme.color.textFaint}
              returnKeyType="search"
              style={[styles.input, styles.destinationSearchInput]}
              value={query}
            />
            <PrimaryButton
              disabled={!searchSubmitState.canSearch}
              label={searchSubmitState.buttonLabel}
              loading={loading}
              onPress={onSearch}
            />
          </View>
        </FormField>
      </SectionCard>

      <PopularDestinationList
        canAddMore={status.canAddMore}
        destinations={popularMatches}
        onAdd={requestAddResult}
        query={trimmedQuery}
        selectedKeys={selectedKeys}
      />

      {shouldShowServerResults ? (
        <SectionCard title="검색 결과" tone="sunken">
          {searchSubmitState.helperText ? <Text style={styles.helperText}>{searchSubmitState.helperText}</Text> : null}
          {loading ? <Text style={styles.helperText}>도시를 검색하는 중...</Text> : null}
          {!loading && trimmedQuery.length >= 2 && !error && !searched ? (
            <Text style={styles.resultEmptyText}>검색 버튼을 눌러 더 찾아보세요.</Text>
          ) : null}
          {!loading && searched && trimmedQuery.length >= 2 && !error && results.length === 0 ? (
            <Text style={styles.resultEmptyText}>검색 결과가 없어요. 인기 도시에서 다시 골라도 돼요.</Text>
          ) : null}
          {results.map((result) => {
            const selected = selectedKeys.has(destinationKey(result));
            const disabled = selected || !status.canAddMore;
            return (
              <SelectableListRow
                accessibilityLabel={`${result.displayName} 도시 추가`}
                actionLabel={selected ? '추가됨' : '추가'}
                disabled={disabled}
                key={destinationKey(result)}
                onPress={() => requestAddResult(result)}
                selected={selected}
                subtitle={`${result.cityName}, ${result.countryName}`}
                title={result.displayName}
              />
            );
          })}
        </SectionCard>
      ) : null}
      {pendingCountryMismatchConfirmation ? (
        <ConfirmationModal
          cancelLabel={pendingCountryMismatchConfirmation.cancelLabel}
          confirmLabel={pendingCountryMismatchConfirmation.confirmLabel}
          message={pendingCountryMismatchConfirmation.message}
          onCancel={() => setPendingCountryMismatchResult(null)}
          onConfirm={confirmCountryMismatchAdd}
          title={pendingCountryMismatchConfirmation.title}
          visible={Boolean(pendingCountryMismatchConfirmation)}
        />
      ) : null}
    </View>
  );
}

type PopularDestinationListProps = {
  canAddMore: boolean;
  destinations: PopularTripDestination[];
  onAdd: (result: DestinationSearchResult) => void;
  query: string;
  selectedKeys: Set<string>;
};

function PopularDestinationList({ canAddMore, destinations, onAdd, query, selectedKeys }: PopularDestinationListProps) {
  return (
    <SectionCard
      helper="원하는 도시를 빠르게 훑고 선택해요."
      meta="TOP 7"
      title={query ? '인기 도시에서 찾음' : '인기 도시'}
      tone="sunken"
    >
      {destinations.length > 0 ? (
        <View style={styles.popularList}>
          {destinations.map((destination) => {
            const selected = selectedKeys.has(destinationKey(destination));
            const disabled = selected || !canAddMore;
            return (
              <SelectableListRow
                accessibilityLabel={`${destination.displayName} 도시 추가`}
                actionLabel={selected ? '추가됨' : '선택'}
                disabled={disabled}
                imageSource={destinationImageSources[destination.imageKey]}
                key={destinationKey(destination)}
                onPress={() => onAdd(destination)}
                selected={selected}
                subtitle={destination.nearbySummary}
                title={destination.cityName}
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.resultEmptyText}>인기 도시에는 없어요. 두 글자 이상 입력하고 검색해요.</Text>
      )}
    </SectionCard>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function buildDestinationSummary(destinations: TripDestinationInput[]): string {
  if (destinations.length === 0) {
    return '도시 선택 전';
  }
  if (destinations.length === 1) {
    return destinations[0].displayName;
  }
  return `${destinations[0].displayName} 외 ${destinations.length - 1}개`;
}

function validateForm(form: FormState, today: string, tripName: string): string | null {
  const name = tripName.trim();
  if (name.length < 1) {
    return '여행 이름을 입력해주세요.';
  }
  if ([...name].length > 80) {
    return '여행 이름은 80자 이내로 입력해주세요.';
  }
  return validateDateRange(form, today) ?? validateSettings(form);
}

function validateDateRange(form: Pick<FormState, 'startDate' | 'endDate'>, today: string): string | null {
  if (!form.startDate || !form.endDate) {
    return '날짜를 선택해주세요.';
  }
  if (!isValidDate(form.startDate) || !isValidDate(form.endDate)) {
    return '날짜는 YYYY-MM-DD 형식으로 입력해주세요.';
  }
  if (form.startDate > form.endDate) {
    return '종료일은 시작일보다 빠를 수 없어요.';
  }
  if (form.startDate < today || form.endDate < today) {
    return '오늘 또는 이후 날짜를 선택해주세요.';
  }
  return null;
}

function validateSettings(form: Pick<FormState, 'defaultCurrency' | 'defaultTravelMode'>): string | null {
  if (!currencies.includes(form.defaultCurrency)) {
    return '지원하는 통화를 선택해주세요.';
  }
  if (!isTripDefaultTravelMode(form.defaultTravelMode)) {
    return '지원하는 이동 방식을 선택해주세요.';
  }
  return null;
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    paddingHorizontal: theme.space[4],
  },
  wizardContent: {
    gap: theme.space[4],
    maxWidth: theme.layout.screenMax,
    width: '100%',
  },
  stepStack: {
    gap: theme.space[4],
  },
  searchPanel: {
    gap: theme.space[4],
    width: '100%',
  },
  searchPanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  searchCountBadge: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  searchCountText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  popularList: {
    gap: theme.space[2],
  },
  resultEmptyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
  },
  inlineHint: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 18,
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
  },
  destinationChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  input: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  summaryRow: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[3],
  },
  summaryLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  summaryValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  destinationSearchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  destinationSearchInput: {
    flex: 1,
  },
  errorText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
});
