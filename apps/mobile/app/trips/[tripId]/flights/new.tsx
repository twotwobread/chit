import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, type TripParticipantListItem } from '@i-um/api-contract';

import { Card, PrimaryButton, theme } from '../../../../lib/design';
import {
  buildFlightCreateRequest,
  defaultFlightCreateFormValues,
  flightEndpointFieldKey,
  flightTimeZoneLabel,
  flightTimeZoneOptions,
  openFlightDateTimePicker,
  validateFlightCreateRequest,
  type FlightCreateFormValues,
  type FlightDateTimePickerTarget,
  type FlightEndpointPrefix,
} from '../../../../lib/flights/create-form';
import { createTripFlight } from '../../../../lib/flights/flight-api';
import { ScheduleTimeWheel } from '../../../../lib/trip-ui/ScheduleTimeWheel';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { dateFromString, monthStringFromDate } from '../../../../lib/trips/date';
import { TripDatePicker } from '../../../../lib/trips/date-picker';
import { listTripParticipants } from '../../../../lib/trips/trip-api';
import { tripFlightDetailPath } from '../../../../lib/trips/routes';

export default function NewFlightScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const [participantsState, setParticipantsState] = useState<
    | { status: 'loading' }
    | { status: 'success'; participants: TripParticipantListItem[] }
    | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<FlightDateTimePickerTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const [form, setForm] = useState<FlightCreateFormValues>(defaultFlightCreateFormValues);

  const loadParticipants = useCallback(async () => {
    if (!tripId) {
      setParticipantsState({ status: 'error', message: '여행 정보를 확인할 수 없어요.' });
      return;
    }
    setParticipantsState({ status: 'loading' });
    try {
      const response = await listTripParticipants(tripId);
      setParticipantsState({ status: 'success', participants: response.participants });
      setSelectedPassengerIds((current) =>
        current.length > 0 ? current : response.participants.map((p) => p.participantId),
      );
    } catch (error) {
      setParticipantsState({ status: 'error', message: participantsErrorMessage(error) });
    }
  }, [tripId]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  const openPicker = useCallback((target: FlightDateTimePickerTarget) => {
    setFeedback(null);
    setForm((current) => {
      const result = openFlightDateTimePicker(current, target);
      if (target.kind === 'date') {
        const dateKey = flightEndpointFieldKey(target.prefix, 'LocalDate');
        setCalendarMonth(monthForFlightDate(current[dateKey]));
      }
      setActivePicker(result.activePicker);
      return result.values;
    });
  }, []);

  const selectDate = useCallback((prefix: FlightEndpointPrefix, date: string) => {
    const dateKey = flightEndpointFieldKey(prefix, 'LocalDate');
    setForm((current) => ({ ...current, [dateKey]: date }));
    setActivePicker(null);
    setFeedback(null);
  }, []);

  const save = useCallback(async () => {
    if (!tripId || participantsState.status !== 'success') {
      return;
    }
    const request = buildFlightCreateRequest(form, selectedPassengerIds);
    const validationError = validateFlightCreateRequest(request);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const response = await createTripFlight(tripId, request);
      router.replace(tripFlightDetailPath(tripId, response.flight.id));
    } catch (error) {
      setFeedback(createErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [form, participantsState.status, selectedPassengerIds, tripId]);

  if (participantsState.status === 'loading') {
    return (
      <TripScreen>
        <TripStateCard helper="탑승자 목록을 불러오는 중이에요." loading title="항공편 추가" />
      </TripScreen>
    );
  }
  if (participantsState.status === 'error') {
    return (
      <TripScreen>
        <TripStateCard
          helper={participantsState.message}
          primaryAction={{ label: '다시 시도', onPress: loadParticipants }}
          title="추가할 수 없어요"
        />
      </TripScreen>
    );
  }

  return (
    <TripScreen keyboardAware>
      <TripScreenHeader
        helper="티켓에 적힌 각 공항 현지 날짜·시간과 시간대를 선택해주세요. 시간대는 목록에서만 선택할 수 있어요."
        title="항공편 추가"
      />
      <Card>
        <Field
          editable={!saving}
          label="표시 이름"
          onChangeText={(value) => setForm((current) => ({ ...current, displayTitle: value }))}
          placeholder="예: KE 017"
          value={form.displayTitle}
        />
        <Field
          editable={!saving}
          label="편명"
          onChangeText={(value) => setForm((current) => ({ ...current, flightNumber: value }))}
          placeholder="선택: KE017"
          value={form.flightNumber}
        />
      </Card>

      <EndpointFields
        activePicker={activePicker}
        calendarMonth={calendarMonth}
        disabled={saving}
        onCalendarMonthChange={setCalendarMonth}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClosePicker={() => setActivePicker(null)}
        onOpenPicker={openPicker}
        onSelectDate={selectDate}
        prefix="departure"
        title="출발"
        values={form}
      />
      <EndpointFields
        activePicker={activePicker}
        calendarMonth={calendarMonth}
        disabled={saving}
        onCalendarMonthChange={setCalendarMonth}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClosePicker={() => setActivePicker(null)}
        onOpenPicker={openPicker}
        onSelectDate={selectDate}
        prefix="arrival"
        title="도착"
        values={form}
      />

      <Card>
        <Text style={styles.sectionTitle}>탑승자</Text>
        {participantsState.participants.map((participant) => {
          const selected = selectedPassengerIds.includes(participant.participantId);
          return (
            <Pressable
              accessibilityLabel={`${participant.displayName} 탑승자 ${selected ? '해제' : '선택'}`}
              accessibilityRole="button"
              disabled={saving}
              key={participant.participantId}
              onPress={() =>
                setSelectedPassengerIds((current) =>
                  current.includes(participant.participantId)
                    ? current.filter((id) => id !== participant.participantId)
                    : [...current, participant.participantId],
                )
              }
              style={({ pressed }) => [
                styles.passengerRow,
                pressed ? styles.pressed : null,
                saving ? styles.disabled : null,
              ]}
            >
              <Text style={styles.passengerName}>{participant.displayName}</Text>
              <Text style={[styles.passengerState, selected ? styles.passengerStateSelected : null]}>
                {selected ? '선택됨' : '선택'}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <PrimaryButton disabled={saving} label="항공편 저장" loading={saving} loadingLabel="저장 중" onPress={save} />
    </TripScreen>
  );
}

function EndpointFields({
  activePicker,
  calendarMonth,
  disabled,
  onCalendarMonthChange,
  onChange,
  onClosePicker,
  onOpenPicker,
  onSelectDate,
  prefix,
  title,
  values,
}: {
  activePicker: FlightDateTimePickerTarget | null;
  calendarMonth: string;
  disabled: boolean;
  onCalendarMonthChange: (month: string) => void;
  onChange: (key: keyof FlightCreateFormValues, value: string) => void;
  onClosePicker: () => void;
  onOpenPicker: (target: FlightDateTimePickerTarget) => void;
  onSelectDate: (prefix: FlightEndpointPrefix, date: string) => void;
  prefix: FlightEndpointPrefix;
  title: string;
  values: FlightCreateFormValues;
}) {
  const airportTextKey = flightEndpointFieldKey(prefix, 'AirportText');
  const airportCodeKey = flightEndpointFieldKey(prefix, 'AirportCode');
  const dateKey = flightEndpointFieldKey(prefix, 'LocalDate');
  const timeKey = flightEndpointFieldKey(prefix, 'LocalTime');
  const timeZoneKey = flightEndpointFieldKey(prefix, 'TimeZone');
  const dateActive = activePicker?.prefix === prefix && activePicker.kind === 'date';
  const timeActive = activePicker?.prefix === prefix && activePicker.kind === 'time';

  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Field
        editable={!disabled}
        label="공항 이름"
        onChangeText={(value) => onChange(airportTextKey, value)}
        placeholder="예: ICN 또는 인천"
        value={values[airportTextKey]}
      />
      <Field
        editable={!disabled}
        label="공항 코드"
        onChangeText={(value) => onChange(airportCodeKey, value)}
        placeholder="선택: ICN"
        value={values[airportCodeKey]}
      />
      <DateTimeField
        calendarMonth={calendarMonth}
        dateActive={dateActive}
        dateValue={values[dateKey]}
        disabled={disabled}
        onCalendarMonthChange={onCalendarMonthChange}
        onChangeTime={(time) => onChange(timeKey, time)}
        onClosePicker={onClosePicker}
        onOpenDate={() => onOpenPicker({ prefix, kind: 'date' })}
        onOpenTime={() => onOpenPicker({ prefix, kind: 'time' })}
        onSelectDate={(date) => onSelectDate(prefix, date)}
        timeActive={timeActive}
        timeValue={values[timeKey]}
        title={title}
      />
      <TimeZoneSelect
        disabled={disabled}
        label="시간대"
        onChange={(value) => onChange(timeZoneKey, value)}
        value={values[timeZoneKey]}
      />
    </Card>
  );
}

function DateTimeField({
  calendarMonth,
  dateActive,
  dateValue,
  disabled,
  onCalendarMonthChange,
  onChangeTime,
  onClosePicker,
  onOpenDate,
  onOpenTime,
  onSelectDate,
  timeActive,
  timeValue,
  title,
}: {
  calendarMonth: string;
  dateActive: boolean;
  dateValue: string;
  disabled: boolean;
  onCalendarMonthChange: (month: string) => void;
  onChangeTime: (time: string) => void;
  onClosePicker: () => void;
  onOpenDate: () => void;
  onOpenTime: () => void;
  onSelectDate: (date: string) => void;
  timeActive: boolean;
  timeValue: string;
  title: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>현지 날짜·시간</Text>
      <View style={styles.dateTimeRow}>
        <DateTimeButton
          active={dateActive}
          disabled={disabled}
          label="날짜"
          onPress={onOpenDate}
          placeholder="날짜 선택"
          value={dateValue}
        />
        <DateTimeButton
          active={timeActive}
          disabled={disabled}
          label="시간"
          onPress={onOpenTime}
          placeholder="시간 선택"
          value={timeValue}
        />
      </View>
      {dateActive ? (
        <TripDatePicker
          helperText="항공권에 표시된 공항 현지 날짜를 선택해주세요."
          label={`${title} 날짜`}
          month={calendarMonth}
          onClose={onClosePicker}
          onMonthChange={onCalendarMonthChange}
          onSelect={onSelectDate}
          selectedDate={dateValue}
          yearOptionRadius={3}
        />
      ) : null}
      {timeActive ? (
        <ScheduleTimeWheel
          disabled={disabled}
          label={`${title} 현지 시간`}
          onChangeTime={onChangeTime}
          value={timeValue}
        />
      ) : null}
    </View>
  );
}

function DateTimeButton({
  active,
  disabled,
  label,
  onPress,
  placeholder,
  value,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label} ${value || placeholder}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateTimeButton,
        active ? styles.dateTimeButtonActive : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={[styles.dateTimeButtonLabel, active ? styles.dateTimeButtonLabelActive : null]}>{label}</Text>
      <Text style={[styles.dateTimeButtonValue, value ? null : styles.placeholderText]}>{value || placeholder}</Text>
    </Pressable>
  );
}

function TimeZoneSelect({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label} 선택`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => [
          styles.selectButton,
          pressed ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <Text style={styles.selectButtonText}>{flightTimeZoneLabel(value)}</Text>
        <Text style={styles.selectChevron}>{open ? '접기' : '변경'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.selectOptions}>
          {flightTimeZoneOptions.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.selectOption,
                  selected ? styles.selectOptionSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.selectOptionText, selected ? styles.selectOptionTextSelected : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={theme.color.textMuted} style={styles.input} {...props} />
    </View>
  );
}

function monthForFlightDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return monthStringFromDate(dateFromString(value));
  }
  return monthStringFromDate(new Date());
}

function participantsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return '다시 로그인해주세요.';
  }
  return '탑승자 목록을 불러올 수 없어요.';
}

function createErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return '입력값을 다시 확인해주세요. 날짜, 시간, 시간대 선택을 확인해주세요.';
  }
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return '이 여행에 항공편을 추가할 수 없어요.';
  }
  return '항공편을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

const styles = StyleSheet.create({
  dateTimeButton: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: theme.space[1],
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  dateTimeButtonActive: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  dateTimeButtonLabel: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  dateTimeButtonLabelActive: {
    color: theme.color.primary,
  },
  dateTimeButtonValue: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  disabled: {
    opacity: 0.5,
  },
  feedback: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
    maxWidth: theme.layout.cardMaxW,
    width: '100%',
  },
  field: {
    gap: theme.space[2],
  },
  input: {
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  passengerName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  passengerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.space[3],
  },
  passengerState: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  passengerStateSelected: {
    color: theme.color.primary,
  },
  placeholderText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontWeight: theme.font.weight.regular,
  },
  pressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  selectButton: {
    alignItems: 'center',
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'space-between',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  selectButtonText: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  selectChevron: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  selectOption: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[3],
  },
  selectOptionSelected: {
    backgroundColor: theme.color.primarySoft,
  },
  selectOptionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  selectOptionTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  selectOptions: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[1],
    padding: theme.space[2],
  },
});
