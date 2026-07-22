import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import type {
  DestinationSearchResult,
  SupportedCurrency,
  TripDefaultTravelMode,
  TripDestinationInput,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import {
  Card,
  ChoiceChip,
  FormField,
  InlineAction,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
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
import { TripDateRangeEditor } from '../../lib/trip-ui/TripDateRangeEditor';
import { dateFromString, isValidDate, monthStringFromDate, todayString } from '../../lib/trips/date';
import {
  applySuggestedTripName,
  createTripWizardSteps,
  nextCreateTripWizardStep,
  previousCreateTripWizardStep,
  suggestTripName,
  type CreateTripWizardStep,
} from '../../lib/trips/create-trip-wizard';
import {
  keepTripDateRangePickerFieldAfterSelect,
  minDateForTripDateRangeField,
  selectTripDateRangeDate,
  type TripDateRangeField,
} from '../../lib/trips/trip-date-range-editor';
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

const stepCopy: Record<CreateTripWizardStep, { title: string; subtitle: string; kicker: string }> = {
  destinations: {
    kicker: '여행의 기준 도시',
    title: '어디로 떠나나요?',
    subtitle: '장소 검색과 지도 추천에 사용할 도시를 먼저 정해요.',
  },
  dates: {
    kicker: '여행 기간',
    title: '언제 머무르나요?',
    subtitle: '시작일과 종료일을 선택하면 Day 일정이 자동으로 준비돼요.',
  },
  settings: {
    kicker: '기본 설정',
    title: '어떤 기준으로 볼까요?',
    subtitle: '지출 통화와 길찾기 기본 이동 방식을 여행에 저장해요.',
  },
  review: {
    kicker: '최종 확인',
    title: '준비한 내용을 확인해요',
    subtitle: '추천 이름을 그대로 쓰거나 원하는 이름으로 바꿀 수 있어요.',
  },
};

export default function NewTripScreen() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [destinations, setDestinations] = useState<TripDestinationInput[]>([]);
  const [wizardStep, setWizardStep] = useState<CreateTripWizardStep>('destinations');
  const [nameEdited, setNameEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<TripDateRangeField | null>(null);
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
  const footerLayout = useStickyActionFooterLayout({ actionCount: isFirstStep ? 1 : 2 });
  const travelModeSelector = buildTripDefaultTravelModeSelectorViewModel(form.defaultTravelMode);
  const destinationSummary = buildDestinationSummary(destinations);
  const dateSummary = form.startDate && form.endDate ? `${form.startDate} ~ ${form.endDate}` : '기간 선택 전';

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

  const openDatePicker = (field: TripDateRangeField) => {
    const value = field === 'startDate' ? form.startDate : form.endDate;
    const minDate = minDateForTripDateRangeField(field, form.startDate, today);
    setCalendarMonth(monthStringFromDate(dateFromString(value || minDate)));
    setActiveDateField(field);
    setError(null);
  };

  const selectDate = (date: string) => {
    if (!activeDateField) {
      return;
    }

    setForm((current) => selectTripDateRangeDate(current, activeDateField, date));
    setActiveDateField(keepTripDateRangePickerFieldAfterSelect(activeDateField));
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
    setActiveDateField(null);
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
        contentContainerStyle={styles.scrollContent}
        keyboardFixedBottomOffset={footerLayout.keyboardFixedBottomOffset}
        keyboardMinClearance={footerLayout.keyboardMinClearance}
        style={styles.scroll}
      >
        <Card style={styles.wizardCard}>
          <View style={styles.stepHero}>
            <View style={styles.stepHeroTopRow}>
              <Text style={styles.stepEyebrow}>STEP {stepIndex + 1} OF 4</Text>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{stepCopy[wizardStep].kicker}</Text>
              </View>
            </View>
            <Text style={styles.stepTitle}>{stepCopy[wizardStep].title}</Text>
            <Text style={styles.stepSubtitle}>{stepCopy[wizardStep].subtitle}</Text>
            <StepProgressSegments activeIndex={stepIndex} />
          </View>

          <View style={styles.stepSummaryStrip}>
            <StepSummaryBadge active={wizardStep === 'destinations'} label="도시" value={destinationSummary} />
            <StepSummaryBadge active={wizardStep === 'dates'} label="기간" value={dateSummary} />
            <StepSummaryBadge active={wizardStep === 'settings'} label="설정" value={form.defaultCurrency} />
          </View>

          <View style={styles.stepDivider} />

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
            <View style={styles.stepStack}>
              <View style={styles.insightPanel}>
                <Text style={styles.insightTitle}>선택한 기간</Text>
                <Text style={styles.insightValue}>{dateSummary}</Text>
                <Text style={styles.insightHelper}>오늘 이후 날짜만 선택할 수 있어요.</Text>
              </View>
              <TripDateRangeEditor
                activeField={activeDateField}
                calendarMonth={calendarMonth}
                disabled={submitting}
                onClosePicker={() => setActiveDateField(null)}
                onMonthChange={setCalendarMonth}
                onOpenField={openDatePicker}
                onSelectDate={selectDate}
                today={today}
                values={form}
                yearOptionCount={yearOptionCount}
              />
            </View>
          ) : null}

          {wizardStep === 'settings' ? (
            <View style={styles.stepStack}>
              <View style={styles.optionCard}>
                <View style={styles.optionCardHeader}>
                  <Text style={styles.optionCardTitle}>기본 통화</Text>
                  <Text style={styles.optionCardHelper}>여행 지출 입력의 기본값으로 사용돼요.</Text>
                </View>
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
              </View>

              <View style={styles.optionCard}>
                <View style={styles.optionCardHeader}>
                  <Text style={styles.optionCardTitle}>{travelModeSelector.label}</Text>
                  <Text style={styles.optionCardHelper}>오늘 화면과 일정 이동 시간 계산의 기본 기준이에요.</Text>
                </View>
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
              </View>
            </View>
          ) : null}

          {wizardStep === 'review' ? (
            <View style={styles.stepStack}>
              <View style={styles.optionCard}>
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
              </View>

              <View style={styles.summaryBox}>
                <SummaryRow
                  label="여행 도시"
                  value={destinations.map((destination) => destination.displayName).join(' · ')}
                />
                <SummaryRow label="여행 기간" value={`${form.startDate} ~ ${form.endDate}`} />
                <SummaryRow label="기본 통화" value={form.defaultCurrency} />
                <SummaryRow label="이동 방식" value={travelModeDisplayLabel(form.defaultTravelMode)} />
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Card>
      </KeyboardAwareFormScrollView>
      <StickyActionFooter actionCount={isFirstStep ? 1 : 2} layout={footerLayout}>
        {!isFirstStep ? <SecondaryButton disabled={submitting} label="이전" onPress={goBack} /> : null}
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

type StepProgressSegmentsProps = {
  activeIndex: number;
};

function StepProgressSegments({ activeIndex }: StepProgressSegmentsProps) {
  return (
    <View accessibilityLabel={`여행 만들기 ${activeIndex + 1}단계`} style={styles.progressSegments}>
      {createTripWizardSteps.map((step, index) => (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          key={step}
          style={[styles.progressSegment, index <= activeIndex ? styles.progressSegmentActive : null]}
        />
      ))}
    </View>
  );
}

type StepSummaryBadgeProps = {
  active: boolean;
  label: string;
  value: string;
};

function StepSummaryBadge({ active, label, value }: StepSummaryBadgeProps) {
  return (
    <View style={[styles.stepSummaryBadge, active ? styles.stepSummaryBadgeActive : null]}>
      <Text style={[styles.stepSummaryLabel, active ? styles.stepSummaryLabelActive : null]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.stepSummaryValue, active ? styles.stepSummaryValueActive : null]}>
        {value}
      </Text>
    </View>
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
      <View style={styles.insightPanel}>
        <Text style={styles.insightTitle}>선택한 도시</Text>
        <Text style={styles.insightValue}>{buildDestinationSummary(destinations)}</Text>
        <Text style={styles.insightHelper}>첫 번째 도시가 대표 도시가 되고, 최대 5개까지 추가할 수 있어요.</Text>
      </View>

      {destinations.length > 0 ? (
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

      {destinationStatus.helperText ? <Text style={styles.helperText}>{destinationStatus.helperText}</Text> : null}
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
  const [pendingCountryMismatchResult, setPendingCountryMismatchResult] = useState<DestinationSearchResult | null>(
    null,
  );
  const pendingCountryMismatchDestination = pendingCountryMismatchResult
    ? tripDestinationInputFromSearchResult(pendingCountryMismatchResult)
    : null;
  const pendingCountryMismatchConfirmation = pendingCountryMismatchDestination
    ? destinationCountryMismatchConfirmation(destinations, pendingCountryMismatchDestination)
    : null;

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
      <FormField label="도시 검색" helperText="도시명이나 지역명을 입력하고 검색해요." errorText={error ?? undefined}>
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

      <View style={styles.resultPanel}>
        <Text style={styles.resultPanelTitle}>검색 결과</Text>
        {searchSubmitState.helperText ? <Text style={styles.helperText}>{searchSubmitState.helperText}</Text> : null}
        {loading ? <Text style={styles.helperText}>도시를 검색하는 중...</Text> : null}
        {!loading && trimmedQuery.length < 2 ? (
          <Text style={styles.resultEmptyText}>두 글자 이상 입력하면 후보 도시를 찾을 수 있어요.</Text>
        ) : null}
        {!loading && trimmedQuery.length >= 2 && !error && !searched ? (
          <Text style={styles.resultEmptyText}>검색 버튼을 눌러 도시를 찾아보세요.</Text>
        ) : null}
        {!loading && searched && trimmedQuery.length >= 2 && !error && results.length === 0 ? (
          <Text style={styles.resultEmptyText}>검색 결과가 없어요.</Text>
        ) : null}
        {results.map((result) => {
          const selected = selectedKeys.has(destinationKey(result));
          const disabled = selected || !status.canAddMore;
          return (
            <View key={destinationKey(result)} style={styles.resultRow}>
              <View style={styles.resultTextBox}>
                <Text style={styles.resultTitle}>{result.displayName}</Text>
                <Text style={styles.resultSubtitle}>
                  {result.cityName}, {result.countryName}
                </Text>
              </View>
              <InlineAction
                disabled={disabled}
                label={selected ? '추가됨' : '추가'}
                onPress={() => requestAddResult(result)}
              />
            </View>
          );
        })}
      </View>
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
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[7],
  },
  wizardCard: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius['2xl'],
    gap: theme.space[5],
    maxWidth: theme.layout.screenMax,
    padding: theme.space[6],
    ...theme.shadow.md,
  },
  stepHero: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  stepHeroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  stepEyebrow: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.bold,
    letterSpacing: 1.1,
  },
  stepBadge: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  stepBadgeText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  stepTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: 22,
  },
  progressSegments: {
    flexDirection: 'row',
    gap: theme.space[2],
    marginTop: theme.space[2],
  },
  progressSegment: {
    backgroundColor: theme.color.ink[100],
    borderRadius: theme.radius.pill,
    flex: 1,
    height: 6,
  },
  progressSegmentActive: {
    backgroundColor: theme.color.uiAccent,
  },
  stepSummaryStrip: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  stepSummaryBadge: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[1],
    minHeight: 56,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[3],
  },
  stepSummaryBadgeActive: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  stepSummaryLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  stepSummaryLabelActive: {
    color: theme.color.textStrong,
  },
  stepSummaryValue: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  stepSummaryValueActive: {
    color: theme.color.textStrong,
  },
  stepDivider: {
    backgroundColor: theme.color.borderSubtle,
    height: 1,
  },
  stepStack: {
    gap: theme.space[5],
  },
  insightPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  insightTitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  insightValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
  },
  insightHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
  },
  searchPanel: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[4],
    ...theme.shadow.xs,
  },
  searchPanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  searchPanelTitleGroup: {
    flex: 1,
    gap: theme.space[2],
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
  resultPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  resultPanelTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  resultEmptyText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  optionCardHeader: {
    gap: theme.space[2],
  },
  optionCardTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  optionCardHelper: {
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
  destinationChip: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  destinationChipText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
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
  optionChip: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[5],
  },
  optionChipSelected: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  optionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  optionTextSelected: {
    color: theme.color.textStrong,
  },
  summaryBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
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
  destinationSearchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.actionPrimary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[2],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
  },
  destinationSearchButtonDisabled: {
    opacity: 0.5,
  },
  destinationSearchButtonText: {
    color: theme.color.onActionPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
    textAlign: 'center',
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    justifyContent: 'space-between',
    padding: theme.space[4],
  },
  resultTextBox: {
    flex: 1,
    gap: theme.space[2],
  },
  resultTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  resultSubtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
  },
  addResultButton: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.uiAccent,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  addResultButtonDisabled: {
    borderColor: theme.color.borderDefault,
  },
  addResultButtonText: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  addResultButtonTextDisabled: {
    color: theme.color.textMuted,
  },
});
