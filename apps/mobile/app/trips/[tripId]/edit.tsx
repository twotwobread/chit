import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, type DateData } from 'react-native-calendars';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { getStoredSession } from '../../../lib/auth/session';
import { theme } from '../../../lib/design';
import { getTripDetail, updateTrip } from '../../../lib/trips/client';
import {
  buildUpdateTripRequest,
  canSubmitTripBasicInfoUpdate,
  supportedCurrencies,
  tripToBasicInfoForm,
  validateTripBasicInfoForm,
  type TripBasicInfoForm,
} from '../../../lib/trips/update-form';

type DateField = 'startDate' | 'endDate';
type LoadState = 'loading' | 'ready' | 'auth' | 'notFound' | 'error';
type CalendarDropdown = 'year' | 'month' | null;

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const yearOptionRadius = 5;

export default function EditTripScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [original, setOriginal] = useState<TripBasicInfoForm | null>(null);
  const [form, setForm] = useState<TripBasicInfoForm | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));

  const load = useCallback(async () => {
    if (!tripId) {
      setLoadState('notFound');
      return;
    }

    setLoadState('loading');
    setSaveError(null);
    try {
      const detail = await getTripDetail(tripId);
      const session = await getStoredSession();
      if (session?.user.id !== detail.trip.createdBy) {
        setLoadState('notFound');
        return;
      }
      const nextForm = tripToBasicInfoForm(detail.trip);
      setOriginal(nextForm);
      setForm(nextForm);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setLoadState('auth');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setLoadState('auth');
          return;
        }
        if (error.status === 400 || error.status === 403 || error.status === 404) {
          setLoadState('notFound');
          return;
        }
      }
      setLoadState('error');
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validationError = form ? validateTripBasicInfoForm(form) : null;
  const canSave = form ? canSubmitTripBasicInfoUpdate({ original, current: form, submitting }) : false;

  const openDatePicker = (field: DateField) => {
    if (!form) {
      return;
    }
    const value = field === 'startDate' ? form.startDate : form.endDate;
    setCalendarMonth(monthStringFromDate(dateFromString(value || todayString())));
    setActiveDateField(field);
    setSaveError(null);
  };

  const selectDate = (date: string) => {
    if (!activeDateField) {
      return;
    }
    setForm((current) => (current ? { ...current, [activeDateField]: date } : current));
    setActiveDateField(null);
  };

  const submit = async () => {
    if (!tripId || !form || !original) {
      return;
    }

    const currentValidationError = validateTripBasicInfoForm(form);
    if (currentValidationError) {
      setSaveError(currentValidationError);
      return;
    }

    const request = buildUpdateTripRequest(original, form);
    if (Object.keys(request).length === 0) {
      setSaveError('변경된 내용이 없어요.');
      return;
    }

    setSubmitting(true);
    setSaveError(null);
    try {
      await updateTrip(tripId, request);
      router.replace(`/trips/${tripId}`);
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setSaveError('다시 로그인해주세요.');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setSaveError('다시 로그인해주세요.');
          return;
        }
        if (error.status === 400) {
          setSaveError(validateTripBasicInfoForm(form) ?? '여행 정보를 수정할 수 없어요. 입력 내용을 확인해주세요.');
          return;
        }
        if (error.status === 403) {
          setSaveError('여행 정보를 수정할 권한이 없어요.');
          return;
        }
        if (error.status === 404) {
          setSaveError('여행을 찾을 수 없어요.');
          return;
        }
      }
      setSaveError('여행 정보를 수정할 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>여행 정보 수정</Text>
        <Text style={styles.subtitle}>이름, 기간, 기본 통화를 바꿀 수 있어요.</Text>
      </View>

      {loadState === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>여행 정보를 불러오는 중...</Text>
        </View>
      ) : null}

      {loadState === 'auth' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
            <Text style={styles.buttonText}>로그인하기</Text>
          </Pressable>
        </View>
      ) : null}

      {loadState === 'notFound' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.button}>
            <Text style={styles.buttonText}>홈으로</Text>
          </Pressable>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>여행 정보를 불러올 수 없어요.</Text>
          <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {loadState === 'ready' && form ? (
        <View style={styles.card}>
          <Field label="여행 이름">
            <TextInput
              editable={!submitting}
              onChangeText={(name) => {
                setForm((current) => (current ? { ...current, name } : current));
                setSaveError(null);
              }}
              placeholder="예: 오사카 3박 4일"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={form.name}
            />
          </Field>

          <Field label="시작일">
            <DateFieldButton disabled={submitting} onPress={() => openDatePicker('startDate')} value={form.startDate} />
          </Field>

          <Field label="종료일">
            <DateFieldButton disabled={submitting} onPress={() => openDatePicker('endDate')} value={form.endDate} />
          </Field>

          {activeDateField ? (
            <CalendarPicker
              label={activeDateField === 'startDate' ? '시작일 선택' : '종료일 선택'}
              month={calendarMonth}
              onClose={() => setActiveDateField(null)}
              onMonthChange={setCalendarMonth}
              onSelect={selectDate}
              selectedDate={activeDateField === 'startDate' ? form.startDate : form.endDate}
            />
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>기본 통화</Text>
            <View style={styles.currencyRow}>
              {supportedCurrencies.map((currency) => {
                const selected = form.defaultCurrency === currency;
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    key={currency}
                    onPress={() => {
                      setForm((current) => (current ? { ...current, defaultCurrency: currency } : current));
                      setSaveError(null);
                    }}
                    style={[styles.currencyChip, selected ? styles.currencyChipSelected : null, submitting ? styles.disabledButton : null]}
                  >
                    <Text style={[styles.currencyText, selected ? styles.currencyTextSelected : null]}>{currency}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
          {!validationError && original && !canSave ? <Text style={styles.helperText}>변경된 내용이 없어요.</Text> : null}
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={() => void submit()}
            style={[styles.button, !canSave ? styles.disabledButton : null]}
          >
            {submitting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.color.onPrimary} />
                <Text style={styles.buttonText}>저장하는 중...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>저장하기</Text>
            )}
          </Pressable>

          <Pressable accessibilityRole="button" disabled={submitting} onPress={() => router.replace(`/trips/${tripId}`)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>취소</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function DateFieldButton({ disabled, onPress, value }: { disabled: boolean; onPress: () => void; value: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.dateButton, disabled ? styles.disabledButton : null]}
    >
      <Text style={styles.dateButtonText}>{value}</Text>
    </Pressable>
  );
}

function CalendarPicker({
  label,
  month,
  onClose,
  onMonthChange,
  onSelect,
  selectedDate,
}: {
  label: string;
  month: string;
  onClose: () => void;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const [openDropdown, setOpenDropdown] = useState<CalendarDropdown>(null);
  const monthDate = dateFromString(month);
  const selectedYear = monthDate.getFullYear();
  const selectedMonth = monthDate.getMonth() + 1;
  const yearOptions = Array.from({ length: yearOptionRadius * 2 + 1 }, (_, index) => selectedYear - yearOptionRadius + index);
  const markedDates = selectedDate
    ? {
        [selectedDate]: {
          selected: true,
          selectedColor: theme.color.primary,
          selectedTextColor: theme.color.onPrimary,
        },
      }
    : undefined;

  const changeMonth = (nextMonth: string) => {
    onMonthChange(nextMonth);
    setOpenDropdown(null);
  };

  const onCalendarMonthChange = (date: DateData) => {
    onMonthChange(monthString(date.year, date.month));
  };

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable accessibilityRole="button" onPress={() => changeMonth(addMonths(month, -1))} style={styles.calendarNavButton}>
          <Text style={styles.calendarNavText}>이전</Text>
        </Pressable>
        <View style={styles.calendarTitleGroup}>
          <Text style={styles.calendarLabel}>{label}</Text>
          <View style={styles.dropdownRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenDropdown(openDropdown === 'year' ? null : 'year')}
              style={styles.dropdownButton}
            >
              <Text style={styles.dropdownButtonText}>{selectedYear}년</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenDropdown(openDropdown === 'month' ? null : 'month')}
              style={styles.dropdownButton}
            >
              <Text style={styles.dropdownButtonText}>{selectedMonth}월</Text>
            </Pressable>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => changeMonth(addMonths(month, 1))} style={styles.calendarNavButton}>
          <Text style={styles.calendarNavText}>다음</Text>
        </Pressable>
      </View>

      {openDropdown === 'year' ? (
        <View style={styles.optionGrid}>
          {yearOptions.map((year) => {
            const selected = year === selectedYear;
            return (
              <Pressable
                accessibilityRole="button"
                key={year}
                onPress={() => changeMonth(monthString(year, selectedMonth))}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
              >
                <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>{year}년</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {openDropdown === 'month' ? (
        <View style={styles.optionGrid}>
          {months.map((monthOption) => {
            const selected = monthOption === selectedMonth;
            return (
              <Pressable
                accessibilityRole="button"
                key={monthOption}
                onPress={() => changeMonth(monthString(selectedYear, monthOption))}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null]}
              >
                <Text style={[styles.optionChipText, selected ? styles.optionChipTextSelected : null]}>{monthOption}월</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Calendar
        current={month}
        enableSwipeMonths
        hideArrows
        hideExtraDays
        key={month}
        markedDates={markedDates}
        onDayPress={(date) => onSelect(date.dateString)}
        onMonthChange={onCalendarMonthChange}
        renderHeader={() => null}
        style={styles.calendar}
        theme={{
          backgroundColor: theme.color.surfaceSunken,
          calendarBackground: theme.color.surfaceSunken,
          dayTextColor: theme.color.textBody,
          selectedDayBackgroundColor: theme.color.primary,
          selectedDayTextColor: theme.color.onPrimary,
          textDayFontFamily: theme.font.family.regular,
          textDayHeaderFontFamily: theme.font.family.semibold,
          textDayHeaderFontWeight: theme.font.weight.semibold,
          textDisabledColor: theme.color.textFaint,
          textSectionTitleColor: theme.color.textMuted,
          todayTextColor: theme.color.primary,
        }}
      />

      <Text style={styles.helperText}>기간은 시작일이 종료일보다 늦지 않게 저장돼요.</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>닫기</Text>
      </Pressable>
    </View>
  );
}

function todayString(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

function monthStringFromDate(date: Date): string {
  return monthString(date.getFullYear(), date.getMonth() + 1);
}

function monthString(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function addMonths(month: string, amount: number): string {
  const date = dateFromString(month);
  return monthStringFromDate(new Date(date.getFullYear(), date.getMonth() + amount, 1));
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
  card: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.layout.gapCard,
    padding: theme.space[7],
    ...theme.shadow.sm,
  },
  field: {
    gap: theme.space[3],
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
  dateButton: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
  },
  dateButtonText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
  },
  calendarCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[5],
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  calendarTitleGroup: {
    alignItems: 'center',
    flex: 1,
    gap: theme.space[3],
  },
  calendarLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  dropdownButton: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  dropdownButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  calendarNavButton: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  calendarNavText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  optionChip: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  optionChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  optionChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  optionChipTextSelected: {
    color: theme.color.primary,
  },
  calendar: {
    backgroundColor: theme.color.surfaceSunken,
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
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.primary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
});
