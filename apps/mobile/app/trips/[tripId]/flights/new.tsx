import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiError, type CreateTripFlightRequest, type TripParticipantListItem } from '@i-um/api-contract';

import { Card, PrimaryButton, theme } from '../../../../lib/design';
import { createTripFlight } from '../../../../lib/flights/flight-api';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { listTripParticipants } from '../../../../lib/trips/trip-api';
import { tripFlightDetailPath } from '../../../../lib/trips/routes';

const DEFAULT_TIME_ZONE = 'Asia/Seoul';

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
  const [form, setForm] = useState({
    displayTitle: '',
    flightNumber: '',
    departureAirportText: '',
    departureAirportCode: '',
    departureLocalDate: '',
    departureLocalTime: '',
    departureTimeZone: DEFAULT_TIME_ZONE,
    arrivalAirportText: '',
    arrivalAirportCode: '',
    arrivalLocalDate: '',
    arrivalLocalTime: '',
    arrivalTimeZone: DEFAULT_TIME_ZONE,
  });

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

  const save = useCallback(async () => {
    if (!tripId || participantsState.status !== 'success') {
      return;
    }
    const request = buildCreateRequest(form, selectedPassengerIds);
    const validationError = validateCreateRequest(request);
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
    <TripScreen>
      <TripScreenHeader
        helper="티켓에 적힌 각 공항 현지 날짜·시간과 IANA 시간대를 입력해주세요. 예: Asia/Seoul, America/Los_Angeles"
        title="항공편 추가"
      />
      <Card>
        <Field
          label="표시 이름"
          onChangeText={(value) => setForm((current) => ({ ...current, displayTitle: value }))}
          placeholder="예: KE 017"
          value={form.displayTitle}
        />
        <Field
          label="편명"
          onChangeText={(value) => setForm((current) => ({ ...current, flightNumber: value }))}
          placeholder="선택: KE017"
          value={form.flightNumber}
        />
      </Card>

      <EndpointFields
        prefix="departure"
        title="출발"
        values={form}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
      />
      <EndpointFields
        prefix="arrival"
        title="도착"
        values={form}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
      />

      <Card>
        <Text style={styles.sectionTitle}>탑승자</Text>
        {participantsState.participants.map((participant) => {
          const selected = selectedPassengerIds.includes(participant.participantId);
          return (
            <Pressable
              accessibilityLabel={`${participant.displayName} 탑승자 ${selected ? '해제' : '선택'}`}
              accessibilityRole="button"
              key={participant.participantId}
              onPress={() =>
                setSelectedPassengerIds((current) =>
                  current.includes(participant.participantId)
                    ? current.filter((id) => id !== participant.participantId)
                    : [...current, participant.participantId],
                )
              }
              style={({ pressed }) => [styles.passengerRow, pressed ? styles.pressed : null]}
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
  onChange,
  prefix,
  title,
  values,
}: {
  title: string;
  prefix: 'departure' | 'arrival';
  values: Record<string, string>;
  onChange: (key: keyof ReturnType<typeof initialFormShape>, value: string) => void;
}) {
  const key = (suffix: string) => `${prefix}${suffix}` as keyof ReturnType<typeof initialFormShape>;
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Field
        label="공항 이름"
        onChangeText={(value) => onChange(key('AirportText'), value)}
        placeholder="예: ICN 또는 인천"
        value={values[key('AirportText')]}
      />
      <Field
        label="공항 코드"
        onChangeText={(value) => onChange(key('AirportCode'), value)}
        placeholder="선택: ICN"
        value={values[key('AirportCode')]}
      />
      <Field
        label="현지 날짜"
        onChangeText={(value) => onChange(key('LocalDate'), value)}
        placeholder="YYYY-MM-DD"
        value={values[key('LocalDate')]}
      />
      <Field
        label="현지 시간"
        onChangeText={(value) => onChange(key('LocalTime'), value)}
        placeholder="HH:mm"
        value={values[key('LocalTime')]}
      />
      <Field
        autoCapitalize="none"
        label="시간대"
        onChangeText={(value) => onChange(key('TimeZone'), value)}
        placeholder="Asia/Seoul"
        value={values[key('TimeZone')]}
      />
    </Card>
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

function initialFormShape() {
  return {
    displayTitle: '',
    flightNumber: '',
    departureAirportText: '',
    departureAirportCode: '',
    departureLocalDate: '',
    departureLocalTime: '',
    departureTimeZone: '',
    arrivalAirportText: '',
    arrivalAirportCode: '',
    arrivalLocalDate: '',
    arrivalLocalTime: '',
    arrivalTimeZone: '',
  };
}

function buildCreateRequest(
  form: ReturnType<typeof initialFormShape>,
  passengerParticipantIds: string[],
): CreateTripFlightRequest {
  return {
    displayTitle: form.displayTitle,
    flightNumber: form.flightNumber.trim() ? form.flightNumber : null,
    departure: {
      airportText: form.departureAirportText,
      airportCode: form.departureAirportCode.trim() ? form.departureAirportCode : null,
      localDate: form.departureLocalDate,
      localTime: form.departureLocalTime,
      timeZone: form.departureTimeZone,
    },
    arrival: {
      airportText: form.arrivalAirportText,
      airportCode: form.arrivalAirportCode.trim() ? form.arrivalAirportCode : null,
      localDate: form.arrivalLocalDate,
      localTime: form.arrivalLocalTime,
      timeZone: form.arrivalTimeZone,
    },
    passengerParticipantIds,
  };
}

function validateCreateRequest(request: CreateTripFlightRequest): string | null {
  if (!request.displayTitle.trim()) {
    return '표시 이름을 입력해주세요.';
  }
  if (!request.departure.airportText.trim() || !request.arrival.airportText.trim()) {
    return '출발/도착 공항을 입력해주세요.';
  }
  if (!request.departure.localDate || !request.departure.localTime || !request.departure.timeZone.trim()) {
    return '출발 날짜, 시간, 시간대를 입력해주세요.';
  }
  if (!request.arrival.localDate || !request.arrival.localTime || !request.arrival.timeZone.trim()) {
    return '도착 날짜, 시간, 시간대를 입력해주세요.';
  }
  if (request.passengerParticipantIds.length === 0) {
    return '탑승자를 한 명 이상 선택해주세요.';
  }
  return null;
}

function participantsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return '다시 로그인해주세요.';
  }
  return '탑승자 목록을 불러올 수 없어요.';
}

function createErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) {
    return '입력값을 다시 확인해주세요. 시간대는 IANA 형식이어야 해요.';
  }
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return '이 여행에 항공편을 추가할 수 없어요.';
  }
  return '항공편을 저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.7,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
});
