import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DestinationSearchResult, SupportedCurrency, TripDestinationInput } from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../lib/design';
import {
  addTripDestination,
  buildCreateTripDestinations,
  buildDestinationSearchContentTopPadding,
  destinationCountryMismatchConfirmation,
  destinationKey,
  destinationSearchSubmitState,
  destinationSelectionStatus,
  removeTripDestination,
  tripDestinationInputFromSearchResult,
  validateTripDestinations,
} from '../../lib/trips/destinations';
import { createTrip, searchDestinations } from '../../lib/trips/trip-api';
import { TripDateRangeEditor } from '../../lib/trip-ui/TripDateRangeEditor';
import { dateFromString, isValidDate, monthStringFromDate, todayString } from '../../lib/trips/date';
import { TripFormField } from '../../lib/trips/date-picker';
import {
  keepTripDateRangePickerFieldAfterSelect,
  minDateForTripDateRangeField,
  selectTripDateRangeDate,
  type TripDateRangeField,
} from '../../lib/trips/trip-date-range-editor';

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  defaultCurrency: SupportedCurrency;
};

const currencies: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];
const yearOptionCount = 10;

const initialForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  defaultCurrency: 'KRW',
};

export default function NewTripScreen() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [destinations, setDestinations] = useState<TripDestinationInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<TripDateRangeField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const [destinationSearchOpen, setDestinationSearchOpen] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationResults, setDestinationResults] = useState<DestinationSearchResult[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationSearched, setDestinationSearched] = useState(false);
  const destinationSearchRequestId = useRef(0);
  const today = todayString();

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
  };

  const submit = async () => {
    const validationError = validateForm(form, today) ?? validateTripDestinations(destinations);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createTrip({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        defaultCurrency: form.defaultCurrency,
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

  const addDestination = (result: DestinationSearchResult) => {
    setDestinations((current) => addTripDestination(current, tripDestinationInputFromSearchResult(result)));
  };

  const destinationStatus = destinationSelectionStatus(destinations);

  if (destinationSearchOpen) {
    return (
      <DestinationSearchFlow
        destinations={destinations}
        error={destinationError}
        loading={destinationLoading}
        onAdd={addDestination}
        onDone={() => setDestinationSearchOpen(false)}
        onQueryChange={updateDestinationQuery}
        onSearch={() => void runDestinationSearch()}
        onRemove={(key) => setDestinations((current) => removeTripDestination(current, key))}
        query={destinationQuery}
        results={destinationResults}
        searched={destinationSearched}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>여행 생성</Text>
        <Text style={styles.subtitle}>여행 도시와 이름, 기간을 정하면 바로 시작할 수 있어요.</Text>
      </View>

      <Card>
        <View style={styles.field}>
          <View style={styles.destinationHeaderRow}>
            <View style={styles.destinationHeaderText}>
              <Text style={styles.label}>여행 도시 *</Text>
              <Text style={styles.helperText}>일정 장소를 검색할 기준 도시를 선택해 주세요.</Text>
            </View>
            <SecondaryButton
              disabled={submitting || !destinationStatus.canAddMore}
              label="+ 도시 검색"
              onPress={() => {
                setDestinationSearchOpen(true);
                setError(null);
              }}
            />
          </View>
          {destinations.length > 0 ? (
            <View style={styles.destinationChipRow}>
              {destinations.map((destination, index) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  key={destinationKey(destination)}
                  onPress={() =>
                    setDestinations((current) => removeTripDestination(current, destinationKey(destination)))
                  }
                  style={styles.destinationChip}
                >
                  <Text style={styles.destinationChipText}>
                    {destination.displayName}
                    {index === 0 ? '  대표' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyDestinationText}>선택한 도시가 없어요.</Text>
          )}
          {destinationStatus.helperText ? <Text style={styles.helperText}>{destinationStatus.helperText}</Text> : null}
        </View>

        <TripFormField label="여행 이름">
          <TextInput
            editable={!submitting}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="예: 오사카 3박 4일"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={form.name}
          />
        </TripFormField>

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

        <View style={styles.field}>
          <Text style={styles.label}>기본 통화</Text>
          <View style={styles.currencyRow}>
            {currencies.map((currency) => {
              const selected = form.defaultCurrency === currency;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  key={currency}
                  onPress={() => setForm((current) => ({ ...current, defaultCurrency: currency }))}
                  style={[styles.currencyChip, selected ? styles.currencyChipSelected : null]}
                >
                  <Text style={[styles.currencyText, selected ? styles.currencyTextSelected : null]}>{currency}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton
          disabled={submitting}
          label="여행 만들기"
          loading={submitting}
          loadingLabel="여행 만드는 중..."
          onPress={() => void submit()}
        />
      </Card>
    </ScrollView>
  );
}

type DestinationSearchFlowProps = {
  destinations: TripDestinationInput[];
  error: string | null;
  loading: boolean;
  onAdd: (result: DestinationSearchResult) => void;
  onDone: () => void;
  onQueryChange: (query: string) => void;
  onRemove: (key: string) => void;
  onSearch: () => void;
  query: string;
  results: DestinationSearchResult[];
  searched: boolean;
};

function DestinationSearchFlow({
  destinations,
  error,
  loading,
  onAdd,
  onDone,
  onQueryChange,
  onRemove,
  onSearch,
  query,
  results,
  searched,
}: DestinationSearchFlowProps) {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      contentContainerStyle={[
        styles.searchContent,
        { paddingTop: buildDestinationSearchContentTopPadding(insets.top) },
      ]}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
    >
      <View style={styles.searchHeader}>
        <Text style={styles.title}>도시 검색</Text>
        <SecondaryButton label="완료" onPress={onDone} />
      </View>

      <Card>
        <View style={styles.field}>
          <Text style={styles.label}>선택한 도시</Text>
          {destinations.length > 0 ? (
            <View style={styles.destinationChipRow}>
              {destinations.map((destination) => (
                <Pressable
                  accessibilityRole="button"
                  key={destinationKey(destination)}
                  onPress={() => onRemove(destinationKey(destination))}
                  style={styles.destinationChip}
                >
                  <Text style={styles.destinationChipText}>{destination.displayName}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyDestinationText}>아직 선택한 도시가 없어요.</Text>
          )}
          {status.helperText ? <Text style={styles.helperText}>{status.helperText}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>어느 도시를 여행하나요?</Text>
          <View style={styles.destinationSearchRow}>
            <TextInput
              autoFocus
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
            <Pressable
              accessibilityRole="button"
              disabled={!searchSubmitState.canSearch}
              onPress={onSearch}
              style={[
                styles.destinationSearchButton,
                !searchSubmitState.canSearch ? styles.destinationSearchButtonDisabled : null,
              ]}
            >
              {loading ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.destinationSearchButtonText}>{searchSubmitState.buttonLabel}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>검색 결과</Text>
          {searchSubmitState.helperText ? <Text style={styles.helperText}>{searchSubmitState.helperText}</Text> : null}
          {loading ? <Text style={styles.helperText}>도시를 검색하는 중...</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {pendingCountryMismatchConfirmation ? (
            <View style={styles.destinationWarningBox}>
              <Text style={styles.destinationWarningTitle}>{pendingCountryMismatchConfirmation.title}</Text>
              <Text style={styles.destinationWarningText}>{pendingCountryMismatchConfirmation.message}</Text>
              <View style={styles.destinationWarningActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPendingCountryMismatchResult(null)}
                  style={styles.destinationWarningSecondaryButton}
                >
                  <Text style={styles.destinationWarningSecondaryText}>
                    {pendingCountryMismatchConfirmation.cancelLabel}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmCountryMismatchAdd}
                  style={styles.destinationWarningPrimaryButton}
                >
                  <Text style={styles.destinationWarningPrimaryText}>
                    {pendingCountryMismatchConfirmation.confirmLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {!loading && trimmedQuery.length >= 2 && !error && !searched ? (
            <Text style={styles.helperText}>검색 버튼을 눌러 도시를 찾아보세요.</Text>
          ) : null}
          {!loading && searched && trimmedQuery.length >= 2 && !error && results.length === 0 ? (
            <Text style={styles.helperText}>검색 결과가 없어요.</Text>
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
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => requestAddResult(result)}
                  style={[styles.addResultButton, disabled ? styles.addResultButtonDisabled : null]}
                >
                  <Text style={[styles.addResultButtonText, disabled ? styles.addResultButtonTextDisabled : null]}>
                    {selected ? '추가됨' : '추가'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>
    </ScrollView>
  );
}

function validateForm(form: FormState, today: string): string | null {
  const name = form.name.trim();
  if (name.length < 1) {
    return '여행 이름을 입력해주세요.';
  }
  if ([...name].length > 80) {
    return '여행 이름은 80자 이내로 입력해주세요.';
  }
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
  if (!currencies.includes(form.defaultCurrency)) {
    return '지원하는 통화를 선택해주세요.';
  }
  return null;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space[7],
  },
  searchContent: {
    flexGrow: 1,
    gap: theme.space[6],
    padding: theme.space[7],
  },
  searchHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    alignSelf: 'center',
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    marginBottom: theme.space[3],
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  field: {
    gap: theme.space[3],
  },
  destinationHeaderRow: {
    gap: theme.space[4],
  },
  destinationHeaderText: {
    gap: theme.space[2],
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
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
  },
  destinationChipText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  emptyDestinationText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  input: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
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
    backgroundColor: theme.color.primary,
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
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  currencyChip: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
  },
  currencyChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  currencyText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  currencyTextSelected: {
    color: theme.color.primary,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  destinationWarningBox: {
    backgroundColor: theme.color.accentSoft,
    borderColor: theme.color.warning,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  destinationWarningTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  destinationWarningText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
  },
  destinationWarningActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
    justifyContent: 'flex-end',
  },
  destinationWarningSecondaryButton: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
  },
  destinationWarningSecondaryText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  destinationWarningPrimaryButton: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
  },
  destinationWarningPrimaryText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  resultRow: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
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
    borderColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
  },
  addResultButtonDisabled: {
    borderColor: theme.color.borderDefault,
  },
  addResultButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  addResultButtonTextDisabled: {
    color: theme.color.textMuted,
  },
});
