import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { theme } from '../design';
import { addMonths, dateFromString, monthString, monthStringFromDate, normalizeMonth } from './date';

type CalendarDropdown = 'year' | 'month' | null;

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const defaultYearOptionRadius = 5;

export function TripFormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export function TripDateFieldButton({
  disabled,
  onPress,
  placeholder = '날짜 선택',
  value,
}: {
  disabled: boolean;
  onPress: () => void;
  placeholder?: string;
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

export function TripDatePicker({
  helperText,
  label,
  minDate,
  month,
  onClose,
  onMonthChange,
  onSelect,
  selectedDate,
  yearOptionCount,
  yearOptionRadius = defaultYearOptionRadius,
}: {
  helperText: string;
  label: string;
  minDate?: string;
  month: string;
  onClose: () => void;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
  yearOptionCount?: number;
  yearOptionRadius?: number;
}) {
  const [openDropdown, setOpenDropdown] = useState<CalendarDropdown>(null);
  const monthDate = dateFromString(month);
  const minDateValue = minDate ? dateFromString(minDate) : null;
  const selectedYear = monthDate.getFullYear();
  const selectedMonth = monthDate.getMonth() + 1;
  const minYear = minDateValue?.getFullYear();
  const minMonth = minDateValue ? minDateValue.getMonth() + 1 : undefined;
  const yearOptions = minYear !== undefined && yearOptionCount
    ? Array.from({ length: yearOptionCount }, (_, index) => minYear + index)
    : Array.from({ length: yearOptionRadius * 2 + 1 }, (_, index) => selectedYear - yearOptionRadius + index);
  const canGoPrevious = minDate ? month > monthStringFromDate(dateFromString(minDate)) : true;
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
    onMonthChange(minDate ? normalizeMonth(nextMonth, minDate) : nextMonth);
    setOpenDropdown(null);
  };

  const onCalendarMonthChange = (date: DateData) => {
    onMonthChange(minDate ? normalizeMonth(monthString(date.year, date.month), minDate) : monthString(date.year, date.month));
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
            const disabled = minYear !== undefined && minMonth !== undefined && selectedYear === minYear && monthOption < minMonth;
            const selected = monthOption === selectedMonth;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={monthOption}
                onPress={() => changeMonth(monthString(selectedYear, monthOption))}
                style={[styles.optionChip, selected ? styles.optionChipSelected : null, disabled ? styles.disabledButton : null]}
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

      <Text style={styles.helperText}>{helperText}</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
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
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  optionChip: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  optionChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  optionChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionChipTextSelected: {
    color: theme.color.primary,
  },
  optionChipTextDisabled: {
    color: theme.color.textFaint,
  },
  calendarNavButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[4],
  },
  calendarNavText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  calendar: {
    borderRadius: theme.radius.md,
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
  },
  secondaryButtonText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
