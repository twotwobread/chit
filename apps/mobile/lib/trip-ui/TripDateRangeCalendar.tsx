import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { theme } from '../design';
import { addMonths, dateFromString, monthString, monthStringFromDate, normalizeMonth } from '../trips/date';
import {
  buildTripDateRangeCalendarState,
  buildTripDateRangeMarkedDates,
  type TripDateRangeCalendarValues,
} from '../trips/trip-date-range-calendar';

type CalendarDropdown = 'year' | 'month' | null;

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function TripDateRangeCalendar({
  calendarMonth,
  disabled,
  onMonthChange,
  onSelectDate,
  today,
  values,
  yearOptionCount = 10,
}: {
  calendarMonth: string;
  disabled: boolean;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  today: string;
  values: TripDateRangeCalendarValues;
  yearOptionCount?: number;
}) {
  const [openDropdown, setOpenDropdown] = useState<CalendarDropdown>(null);
  const state = buildTripDateRangeCalendarState(values);
  const monthDate = dateFromString(calendarMonth);
  const todayDate = dateFromString(today);
  const selectedYear = monthDate.getFullYear();
  const selectedMonth = monthDate.getMonth() + 1;
  const minYear = todayDate.getFullYear();
  const minMonth = todayDate.getMonth() + 1;
  const yearOptions = Array.from({ length: yearOptionCount }, (_, index) => minYear + index);
  const canGoPrevious = calendarMonth > monthStringFromDate(todayDate);
  const markedDates = buildTripDateRangeMarkedDates(values, {
    rangeColor: theme.color.actionPrimary,
    rangeTextColor: theme.color.onActionPrimary,
  });

  const changeMonth = (nextMonth: string) => {
    onMonthChange(normalizeMonth(nextMonth, today));
    setOpenDropdown(null);
  };

  const onCalendarMonthChange = (date: DateData) => {
    onMonthChange(normalizeMonth(monthString(date.year, date.month), today));
  };

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.rangeSelectionPanel}>
        <View style={styles.rangeChipRow}>
          <View style={[styles.rangeChip, state.nextSelection === 'startDate' ? styles.rangeChipActive : null]}>
            <Text style={styles.rangeChipLabel}>시작</Text>
            <Text style={styles.rangeChipValue}>{state.startLabel}</Text>
          </View>
          <View style={[styles.rangeChip, state.nextSelection === 'endDate' ? styles.rangeChipActive : null]}>
            <Text style={styles.rangeChipLabel}>종료</Text>
            <Text style={styles.rangeChipValue}>{state.endLabel}</Text>
          </View>
        </View>
        <Text style={styles.rangeHelper}>{state.helperText}</Text>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoPrevious || disabled}
            onPress={() => changeMonth(addMonths(calendarMonth, -1))}
            style={[styles.calendarNavButton, !canGoPrevious || disabled ? styles.disabledButton : null]}
          >
            <Text style={styles.calendarNavText}>이전</Text>
          </Pressable>
          <View style={styles.calendarTitleGroup}>
            <Text style={styles.calendarLabel}>
              {state.nextSelection === 'startDate' ? '시작일 선택' : '종료일 선택'}
            </Text>
            <View style={styles.dropdownRow}>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => setOpenDropdown(openDropdown === 'year' ? null : 'year')}
                style={[styles.dropdownButton, disabled ? styles.disabledButton : null]}
              >
                <Text style={styles.dropdownButtonText}>{selectedYear}년</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={() => setOpenDropdown(openDropdown === 'month' ? null : 'month')}
                style={[styles.dropdownButton, disabled ? styles.disabledButton : null]}
              >
                <Text style={styles.dropdownButtonText}>{selectedMonth}월</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => changeMonth(addMonths(calendarMonth, 1))}
            style={[styles.calendarNavButton, disabled ? styles.disabledButton : null]}
          >
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
                  disabled={disabled}
                  key={year}
                  onPress={() => changeMonth(monthString(year, selectedMonth))}
                  style={[
                    styles.optionChip,
                    selected ? styles.optionChipSelected : null,
                    disabled ? styles.disabledButton : null,
                  ]}
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
              const optionMonth = monthString(selectedYear, monthOption);
              const monthDisabled = disabled || (selectedYear === minYear && monthOption < minMonth);
              const selected = monthOption === selectedMonth;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={monthDisabled}
                  key={monthOption}
                  onPress={() => changeMonth(optionMonth)}
                  style={[
                    styles.optionChip,
                    selected ? styles.optionChipSelected : null,
                    monthDisabled ? styles.disabledButton : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      selected ? styles.optionChipTextSelected : null,
                      monthDisabled ? styles.optionChipTextDisabled : null,
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
          current={calendarMonth}
          enableSwipeMonths={!disabled}
          hideArrows
          hideExtraDays
          key={calendarMonth}
          markedDates={markedDates}
          markingType="period"
          minDate={today}
          onDayPress={(date) => {
            if (!disabled) {
              onSelectDate(date.dateString);
            }
          }}
          onMonthChange={onCalendarMonthChange}
          renderHeader={() => null}
          style={styles.calendar}
          theme={{
            backgroundColor: theme.color.surfaceSunken,
            calendarBackground: theme.color.surfaceSunken,
            dayTextColor: theme.color.textBody,
            monthTextColor: theme.color.textStrong,
            textDayFontFamily: theme.font.family.regular,
            textDayHeaderFontFamily: theme.font.family.semibold,
            textDayHeaderFontWeight: theme.font.weight.semibold,
            textDisabledColor: theme.color.textFaint,
            textSectionTitleColor: theme.color.textMuted,
            todayTextColor: theme.color.uiAccent,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    borderRadius: theme.radius.md,
  },
  calendarCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[4],
    padding: theme.space[4],
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
  },
  calendarLabel: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  calendarNavButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[3],
  },
  calendarNavText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  calendarPanel: {
    gap: theme.space[4],
  },
  calendarTitleGroup: {
    alignItems: 'center',
    flex: 1,
    gap: theme.space[3],
  },
  disabledButton: {
    opacity: 0.5,
  },
  dropdownButton: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[3],
  },
  dropdownButtonText: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  optionChip: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  optionChipSelected: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  optionChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  optionChipTextDisabled: {
    color: theme.color.textFaint,
  },
  optionChipTextSelected: {
    color: theme.color.textStrong,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  rangeChip: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[1],
    minHeight: theme.layout.tapMin,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rangeChipActive: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  rangeChipLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.micro,
    fontWeight: theme.font.weight.semibold,
  },
  rangeChipRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  rangeChipValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  rangeHelper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: 18,
  },
  rangeSelectionPanel: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[3],
  },
});
