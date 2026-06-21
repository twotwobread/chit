import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Calendar, type DateData } from 'react-native-calendars';

import type { CreateTripResponse, SupportedCurrency } from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import { theme } from '../../lib/design';
import { createTrip } from '../../lib/trips/client';

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  defaultCurrency: SupportedCurrency;
};

type DateField = 'startDate' | 'endDate';
type CalendarDropdown = 'year' | 'month' | null;

const currencies: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];
const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const yearOptionCount = 10;

const initialForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  defaultCurrency: 'KRW',
};

export default function NewTripScreen() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTripResponse | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const today = todayString();

  const openDatePicker = (field: DateField) => {
    const value = field === 'startDate' ? form.startDate : form.endDate;
    const minDate = minDateForField(field, form.startDate, today);
    setCalendarMonth(monthStringFromDate(dateFromString(value || minDate)));
    setActiveDateField(field);
    setError(null);
  };

  const selectDate = (date: string) => {
    if (!activeDateField) {
      return;
    }

    setForm((current) => {
      if (activeDateField === 'startDate') {
        return {
          ...current,
          startDate: date,
          endDate: current.endDate && current.endDate < date ? '' : current.endDate,
        };
      }
      return { ...current, endDate: date };
    });
    setActiveDateField(null);
  };

  const submit = async () => {
    const validationError = validateForm(form, today);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await createTrip({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        defaultCurrency: form.defaultCurrency,
      });
      setCreated(response);
    } catch (submitError) {
      if (submitError instanceof MobileAuthError && submitError.code === 'INVALID_REFRESH_TOKEN') {
        setError('다시 로그인해주세요.');
      } else {
        setError('여행을 만들 수 없어요. 입력 내용을 확인하고 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setError(null);
    setCreated(null);
    setActiveDateField(null);
  };

  if (created) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.successTitle}>여행이 만들어졌어요.</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{created.trip.name}</Text>
            <Text style={styles.summaryText}>
              {created.trip.startDate} ~ {created.trip.endDate}
            </Text>
            <Text style={styles.summaryText}>기본 통화: {created.trip.defaultCurrency}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/trips/${created.trip.id}`)} style={styles.button}>
            <Text style={styles.buttonText}>여행 상세 보기</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>새 여행 만들기</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>홈으로</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>새 여행 만들기</Text>
        <Text style={styles.subtitle}>이름과 기간만 정하면 바로 시작할 수 있어요.</Text>
      </View>

      <View style={styles.card}>
        <Field label="여행 이름">
          <TextInput
            editable={!submitting}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="예: 오사카 3박 4일"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={form.name}
          />
        </Field>

        <Field label="시작일">
          <DateFieldButton
            disabled={submitting}
            onPress={() => openDatePicker('startDate')}
            placeholder="날짜 선택"
            value={form.startDate}
          />
        </Field>

        <Field label="종료일">
          <DateFieldButton
            disabled={submitting}
            onPress={() => openDatePicker('endDate')}
            placeholder="날짜 선택"
            value={form.endDate}
          />
        </Field>

        {activeDateField ? (
          <CalendarPicker
            label={activeDateField === 'startDate' ? '시작일 선택' : '종료일 선택'}
            minDate={minDateForField(activeDateField, form.startDate, today)}
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

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void submit()}
          style={[styles.button, submitting ? styles.disabledButton : null]}
        >
          {submitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.color.onPrimary} />
              <Text style={styles.buttonText}>여행 만드는 중...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>여행 만들기</Text>
          )}
        </Pressable>
      </View>
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

function DateFieldButton({
  disabled,
  onPress,
  placeholder,
  value,
}: {
  disabled: boolean;
  onPress: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.dateButton, disabled ? styles.disabledButton : null]}
    >
      <Text style={value ? styles.dateButtonText : styles.datePlaceholderText}>{value || placeholder}</Text>
    </Pressable>
  );
}

function CalendarPicker({
  label,
  minDate,
  month,
  onClose,
  onMonthChange,
  onSelect,
  selectedDate,
}: {
  label: string;
  minDate: string;
  month: string;
  onClose: () => void;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const [openDropdown, setOpenDropdown] = useState<CalendarDropdown>(null);
  const monthDate = dateFromString(month);
  const minDateValue = dateFromString(minDate);
  const selectedYear = monthDate.getFullYear();
  const selectedMonth = monthDate.getMonth() + 1;
  const minYear = minDateValue.getFullYear();
  const minMonth = minDateValue.getMonth() + 1;
  const yearOptions = Array.from({ length: yearOptionCount }, (_, index) => minYear + index);
  const canGoPrevious = month > monthStringFromDate(minDateValue);
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
    onMonthChange(normalizeMonth(nextMonth, minDate));
    setOpenDropdown(null);
  };

  const selectYear = (year: number) => {
    changeMonth(monthString(year, selectedMonth));
  };

  const selectMonth = (nextMonth: number) => {
    changeMonth(monthString(selectedYear, nextMonth));
  };

  const onCalendarMonthChange = (date: DateData) => {
    onMonthChange(monthString(date.year, date.month));
  };

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityRole="button"
          disabled={!canGoPrevious}
          onPress={() => changeMonth(addMonths(month, -1))}
          style={[styles.calendarNavButton, !canGoPrevious ? styles.disabledButton : null]}
        >
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
                onPress={() => selectYear(year)}
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
            const disabled = selectedYear === minYear && monthOption < minMonth;
            const selected = monthOption === selectedMonth;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={monthOption}
                onPress={() => selectMonth(monthOption)}
                style={[
                  styles.optionChip,
                  selected ? styles.optionChipSelected : null,
                  disabled ? styles.disabledButton : null,
                ]}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    selected ? styles.optionChipTextSelected : null,
                    disabled ? styles.optionChipTextDisabled : null,
                  ]}
                >
                  {monthOption}월
                </Text>
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
        minDate={minDate}
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

      <Text style={styles.helperText}>오늘 이전 날짜는 선택할 수 없어요.</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>닫기</Text>
      </Pressable>
    </View>
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

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function minDateForField(field: DateField, startDate: string, today: string): string {
  if (field === 'endDate' && isValidDate(startDate) && startDate > today) {
    return startDate;
  }
  return today;
}

function todayString(): string {
  return formatLocalDate(new Date());
}

function formatLocalDate(date: Date): string {
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

function normalizeMonth(month: string, minDate: string): string {
  return month < monthStringFromDate(dateFromString(minDate)) ? monthStringFromDate(dateFromString(minDate)) : month;
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
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
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
  datePlaceholderText: {
    color: theme.color.textFaint,
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
  optionChipTextDisabled: {
    color: theme.color.textFaint,
  },
  calendar: {
    backgroundColor: theme.color.surfaceSunken,
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
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
  successTitle: {
    color: theme.color.success,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summaryBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summaryText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
});
