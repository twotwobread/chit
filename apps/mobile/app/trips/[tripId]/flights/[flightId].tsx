import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import {
  ApiError,
  type FlightDetail,
  type MyFlightPersonalDetail,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../lib/design';
import {
  FlightUploadError,
  addTripFlightPassengers,
  deleteMyFlightBoardingPass,
  getTripFlight,
  openMyFlightBoardingPass,
  updateTripFlight,
  uploadMyFlightBoardingPassBinary,
  upsertMyFlightPersonalDetail,
} from '../../../../lib/flights/flight-api';
import {
  buildFlightUpdateRequest,
  flightDetailToEditFormValues,
  validateFlightUpdateRequest,
  type FlightEditFormValues,
} from '../../../../lib/flights/edit-form';
import {
  buildAddableFlightPassengerOptions,
  canSubmitAddFlightPassengers,
  toggleFlightPassengerSelection,
  validateAddFlightPassengers,
} from '../../../../lib/flights/passengers';
import { buildFlightCardViewModel, flightDetailPrivacyNotice } from '../../../../lib/flights/view-model';
import { TripScreen, TripScreenHeader, TripStateCard } from '../../../../lib/trip-ui/TripScreenScaffold';
import { listTripParticipants } from '../../../../lib/trips/trip-api';

export default function FlightDetailScreen() {
  const { tripId: tripIdParam, flightId: flightIdParam } = useLocalSearchParams<{
    tripId?: string | string[];
    flightId?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const flightId = Array.isArray(flightIdParam) ? flightIdParam[0] : flightIdParam;
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'success'; flight: FlightDetail } | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [draft, setDraft] = useState({ reservationNumber: '', seat: '', checkInUrl: '' });
  const [editDraft, setEditDraft] = useState<FlightEditFormValues | null>(null);
  const [editSharedOpen, setEditSharedOpen] = useState(false);
  const [updatingShared, setUpdatingShared] = useState(false);
  const [participantsState, setParticipantsState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; participants: TripParticipantListItem[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [addPassengersOpen, setAddPassengersOpen] = useState(false);
  const [selectedPassengerIds, setSelectedPassengerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [addingPassengers, setAddingPassengers] = useState(false);
  const [opening, setOpening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadParticipants = useCallback(async () => {
    if (!tripId) {
      setParticipantsState({ status: 'error', message: '여행 정보를 확인할 수 없어요.' });
      return;
    }
    setParticipantsState({ status: 'loading' });
    try {
      const response = await listTripParticipants(tripId);
      setParticipantsState({ status: 'success', participants: response.participants });
    } catch (error) {
      setParticipantsState({ status: 'error', message: participantsErrorMessage(error) });
    }
  }, [tripId]);

  const load = useCallback(async () => {
    if (!tripId || !flightId) {
      setState({ status: 'error', message: '항공편 정보를 확인할 수 없어요.' });
      return;
    }
    setState({ status: 'loading' });
    setFeedback(null);
    try {
      const response = await getTripFlight(tripId, flightId);
      setState({ status: 'success', flight: response.flight });
      setDraft(personalDetailToDraft(response.flight.myPersonalDetail));
      setEditDraft(flightDetailToEditFormValues(response.flight));
      setSelectedPassengerIds([]);
      setEditSharedOpen(false);
      setAddPassengersOpen(false);
    } catch (error) {
      setState({ status: 'error', message: flightDetailErrorMessage(error) });
    }
  }, [flightId, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSharedEdit = useCallback(() => {
    if (state.status !== 'success') {
      return;
    }
    setEditDraft(flightDetailToEditFormValues(state.flight));
    setEditSharedOpen(true);
    setFeedback(null);
  }, [state]);

  const setEditField = useCallback((key: keyof FlightEditFormValues, value: string) => {
    setEditDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const saveSharedEdit = useCallback(async () => {
    if (!tripId || !flightId || state.status !== 'success' || !editDraft || updatingShared) {
      return;
    }
    const request = buildFlightUpdateRequest(editDraft);
    const validationError = validateFlightUpdateRequest(request);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setUpdatingShared(true);
    setFeedback(null);
    try {
      const response = await updateTripFlight(tripId, flightId, request);
      setState({ status: 'success', flight: response.flight });
      setDraft(personalDetailToDraft(response.flight.myPersonalDetail));
      setEditDraft(flightDetailToEditFormValues(response.flight));
      setEditSharedOpen(false);
      setFeedback('공유 항공편 정보를 수정했어요.');
    } catch (error) {
      setFeedback(updateFlightErrorMessage(error));
    } finally {
      setUpdatingShared(false);
    }
  }, [editDraft, flightId, state.status, tripId, updatingShared]);

  const openAddPassengers = useCallback(() => {
    setAddPassengersOpen(true);
    setSelectedPassengerIds([]);
    setFeedback(null);
    void loadParticipants();
  }, [loadParticipants]);

  const save = useCallback(async () => {
    if (!tripId || !flightId || state.status !== 'success') {
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await upsertMyFlightPersonalDetail(tripId, flightId, {
        reservationNumber: nullableText(draft.reservationNumber),
        seat: nullableText(draft.seat),
        checkInUrl: nullableText(draft.checkInUrl),
      });
      setState((current) =>
        current.status === 'success'
          ? { status: 'success', flight: { ...current.flight, myPersonalDetail: response.personalDetail } }
          : current,
      );
      setFeedback('내 항공권 정보를 저장했어요.');
    } catch (error) {
      setFeedback(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draft, flightId, state.status, tripId]);

  const saveAddPassengers = useCallback(async () => {
    if (!tripId || !flightId || state.status !== 'success' || addingPassengers) {
      return;
    }
    const validationError = validateAddFlightPassengers(selectedPassengerIds);
    if (validationError) {
      setFeedback(validationError);
      return;
    }

    setAddingPassengers(true);
    setFeedback(null);
    try {
      const response = await addTripFlightPassengers(tripId, flightId, {
        passengerParticipantIds: selectedPassengerIds,
      });
      setState({ status: 'success', flight: response.flight });
      setDraft(personalDetailToDraft(response.flight.myPersonalDetail));
      setEditDraft(flightDetailToEditFormValues(response.flight));
      setSelectedPassengerIds([]);
      setAddPassengersOpen(false);
      setFeedback('탑승자를 추가했어요.');
    } catch (error) {
      setFeedback(addPassengersErrorMessage(error));
    } finally {
      setAddingPassengers(false);
    }
  }, [addingPassengers, flightId, selectedPassengerIds, state.status, tripId]);

  const uploadBoardingPass = useCallback(async () => {
    if (!tripId || !flightId) {
      return;
    }
    setUploading(true);
    setFeedback(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFeedback('사진 접근 권한이 필요해요. 권한을 허용한 뒤 다시 시도해주세요.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? '';
      if (!isSupportedBoardingPassImage(contentType)) {
        setFeedback('JPEG, PNG, WebP 이미지만 올릴 수 있어요.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        setFeedback('탑승권 이미지는 10MB 이하만 올릴 수 있어요.');
        return;
      }
      const response = await uploadMyFlightBoardingPassBinary({ tripId, flightId, uri: asset.uri, contentType });
      setState((current) =>
        current.status === 'success'
          ? { status: 'success', flight: { ...current.flight, myPersonalDetail: response.personalDetail } }
          : current,
      );
      setFeedback('탑승권 이미지를 저장했어요.');
    } catch (error) {
      setFeedback(uploadErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }, [flightId, tripId]);

  const deleteBoardingPass = useCallback(() => {
    if (!tripId || !flightId || deleting) {
      return;
    }
    Alert.alert('탑승권을 삭제할까요?', '내 탑승권 이미지 연결을 삭제합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          setFeedback(null);
          void deleteMyFlightBoardingPass(tripId, flightId)
            .then(() => {
              setState((current) => {
                if (current.status !== 'success' || !current.flight.myPersonalDetail) {
                  return current;
                }
                return {
                  status: 'success',
                  flight: {
                    ...current.flight,
                    myPersonalDetail: {
                      ...current.flight.myPersonalDetail,
                      boardingPass: { exists: false, contentType: null, byteSize: null, uploadedAt: null },
                    },
                  },
                };
              });
              setFeedback('탑승권 이미지를 삭제했어요.');
            })
            .catch(() => setFeedback('탑승권 이미지를 삭제할 수 없어요. 잠시 후 다시 시도해주세요.'))
            .finally(() => setDeleting(false));
        },
      },
    ]);
  }, [deleting, flightId, tripId]);

  const openBoardingPass = useCallback(async () => {
    if (!tripId || !flightId) {
      return;
    }
    setOpening(true);
    setFeedback(null);
    try {
      const response = await openMyFlightBoardingPass(tripId, flightId);
      await Linking.openURL(response.url);
    } catch (error) {
      setFeedback(openErrorMessage(error));
    } finally {
      setOpening(false);
    }
  }, [flightId, tripId]);

  if (state.status === 'loading') {
    return (
      <TripScreen>
        <TripStateCard helper="공유 항공편과 내 개인 정보를 불러오는 중이에요." loading title="항공편" />
      </TripScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <TripScreen>
        <TripStateCard
          helper={state.message}
          primaryAction={{ label: '다시 시도', onPress: load }}
          title="항공편을 볼 수 없어요"
        />
      </TripScreen>
    );
  }

  const card = buildFlightCardViewModel(state.flight);
  const isPassenger = Boolean(state.flight.myPersonalDetail);
  const boardingPass = state.flight.myPersonalDetail?.boardingPass;
  const addablePassengerOptions =
    participantsState.status === 'success'
      ? buildAddableFlightPassengerOptions({
          participants: participantsState.participants,
          passengers: state.flight.passengers,
          selectedPassengerIds,
        })
      : [];

  return (
    <TripScreen keyboardAware>
      <TripScreenHeader helper={flightDetailPrivacyNotice(isPassenger)} title={card.title} />
      <Card>
        <Text style={styles.route}>{card.routeLabel}</Text>
        <Text style={styles.helper}>{card.timeLabel}</Text>
        <Text style={styles.helper}>탑승자 {card.passengerLabel}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>공유 항공편 정보</Text>
        <Text style={styles.helper}>일정 참여자는 누구나 편명, 공항, 날짜와 시간을 수정할 수 있어요.</Text>
        {!editSharedOpen || !editDraft ? (
          <SecondaryButton disabled={updatingShared} label="공유 항공편 정보 수정" onPress={openSharedEdit} />
        ) : (
          <>
            <LabeledInput
              editable={!updatingShared}
              label="표시 이름"
              onChangeText={(value) => setEditField('displayTitle', value)}
              placeholder="예: KE 018"
              value={editDraft.displayTitle}
            />
            <LabeledInput
              editable={!updatingShared}
              label="편명"
              onChangeText={(value) => setEditField('flightNumber', value)}
              placeholder="선택: KE018"
              value={editDraft.flightNumber}
            />
            <Text style={styles.subsectionTitle}>출발</Text>
            <LabeledInput
              editable={!updatingShared}
              label="공항"
              onChangeText={(value) => setEditField('departureAirportText', value)}
              placeholder="예: 인천"
              value={editDraft.departureAirportText}
            />
            <LabeledInput
              autoCapitalize="characters"
              editable={!updatingShared}
              label="공항 코드"
              onChangeText={(value) => setEditField('departureAirportCode', value)}
              placeholder="선택: ICN"
              value={editDraft.departureAirportCode}
            />
            <LabeledInput
              editable={!updatingShared}
              label="날짜"
              onChangeText={(value) => setEditField('departureLocalDate', value)}
              placeholder="YYYY-MM-DD"
              value={editDraft.departureLocalDate}
            />
            <LabeledInput
              editable={!updatingShared}
              label="시간"
              onChangeText={(value) => setEditField('departureLocalTime', value)}
              placeholder="HH:mm"
              value={editDraft.departureLocalTime}
            />
            <LabeledInput
              autoCapitalize="none"
              editable={!updatingShared}
              label="시간대"
              onChangeText={(value) => setEditField('departureTimeZone', value)}
              placeholder="Asia/Seoul"
              value={editDraft.departureTimeZone}
            />
            <Text style={styles.subsectionTitle}>도착</Text>
            <LabeledInput
              editable={!updatingShared}
              label="공항"
              onChangeText={(value) => setEditField('arrivalAirportText', value)}
              placeholder="예: 로스앤젤레스"
              value={editDraft.arrivalAirportText}
            />
            <LabeledInput
              autoCapitalize="characters"
              editable={!updatingShared}
              label="공항 코드"
              onChangeText={(value) => setEditField('arrivalAirportCode', value)}
              placeholder="선택: LAX"
              value={editDraft.arrivalAirportCode}
            />
            <LabeledInput
              editable={!updatingShared}
              label="날짜"
              onChangeText={(value) => setEditField('arrivalLocalDate', value)}
              placeholder="YYYY-MM-DD"
              value={editDraft.arrivalLocalDate}
            />
            <LabeledInput
              editable={!updatingShared}
              label="시간"
              onChangeText={(value) => setEditField('arrivalLocalTime', value)}
              placeholder="HH:mm"
              value={editDraft.arrivalLocalTime}
            />
            <LabeledInput
              autoCapitalize="none"
              editable={!updatingShared}
              label="시간대"
              onChangeText={(value) => setEditField('arrivalTimeZone', value)}
              placeholder="America/Los_Angeles"
              value={editDraft.arrivalTimeZone}
            />
            <SecondaryButton
              disabled={updatingShared}
              label="닫기"
              onPress={() => {
                setEditSharedOpen(false);
                setEditDraft(flightDetailToEditFormValues(state.flight));
              }}
            />
            <PrimaryButton
              disabled={updatingShared}
              label="공유 정보 저장"
              loading={updatingShared}
              loadingLabel="저장 중"
              onPress={saveSharedEdit}
            />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>탑승자 추가</Text>
        <Text style={styles.helper}>현재 일정 참여자 중 아직 이 항공편 탑승자가 아닌 사람을 추가할 수 있어요.</Text>
        {!addPassengersOpen ? (
          <SecondaryButton disabled={addingPassengers} label="탑승자 추가" onPress={openAddPassengers} />
        ) : (
          <>
            {participantsState.status === 'loading' ? (
              <Text style={styles.helper}>참여자 목록을 불러오는 중이에요.</Text>
            ) : null}
            {participantsState.status === 'error' ? (
              <>
                <Text style={styles.helper}>{participantsState.message}</Text>
                <SecondaryButton disabled={addingPassengers} label="다시 시도" onPress={loadParticipants} />
              </>
            ) : null}
            {participantsState.status === 'success' ? (
              <>
                {addablePassengerOptions.length === 0 ? (
                  <Text style={styles.helper}>추가할 수 있는 참여자가 없어요.</Text>
                ) : (
                  addablePassengerOptions.map((option) => (
                    <Pressable
                      accessibilityLabel={`${option.displayName} 탑승자 ${option.selected ? '해제' : '선택'}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: addingPassengers, selected: option.selected }}
                      disabled={addingPassengers}
                      key={option.participantId}
                      onPress={() =>
                        setSelectedPassengerIds((current) =>
                          toggleFlightPassengerSelection(current, option.participantId),
                        )
                      }
                      style={({ pressed }) => [
                        styles.addPassengerRow,
                        option.selected ? styles.addPassengerRowSelected : null,
                        pressed ? styles.pressed : null,
                        addingPassengers ? styles.disabled : null,
                      ]}
                    >
                      <Text style={styles.addPassengerName}>{option.displayName}</Text>
                      <Text
                        style={[styles.addPassengerState, option.selected ? styles.addPassengerStateSelected : null]}
                      >
                        {option.selected ? '선택됨' : '선택'}
                      </Text>
                    </Pressable>
                  ))
                )}
                <SecondaryButton
                  disabled={addingPassengers}
                  label="닫기"
                  onPress={() => {
                    setAddPassengersOpen(false);
                    setSelectedPassengerIds([]);
                  }}
                />
                <PrimaryButton
                  disabled={!canSubmitAddFlightPassengers(selectedPassengerIds, addingPassengers)}
                  label="선택한 탑승자 추가"
                  loading={addingPassengers}
                  loadingLabel="추가 중"
                  onPress={saveAddPassengers}
                />
              </>
            ) : null}
          </>
        )}
      </Card>

      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

      {isPassenger ? (
        <Card>
          <Text style={styles.sectionTitle}>내 항공권 정보</Text>
          <LabeledInput
            label="예약번호"
            onChangeText={(value) => setDraft((current) => ({ ...current, reservationNumber: value }))}
            placeholder="예: ABC123"
            value={draft.reservationNumber}
          />
          <LabeledInput
            label="좌석"
            onChangeText={(value) => setDraft((current) => ({ ...current, seat: value }))}
            placeholder="예: 12A"
            value={draft.seat}
          />
          <LabeledInput
            autoCapitalize="none"
            label="체크인 링크"
            onChangeText={(value) => setDraft((current) => ({ ...current, checkInUrl: value }))}
            placeholder="https://..."
            value={draft.checkInUrl}
          />
          <PrimaryButton disabled={saving} label="저장" loading={saving} loadingLabel="저장 중" onPress={save} />
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>탑승권 이미지</Text>
          <Text style={styles.helper}>
            {boardingPass?.exists
              ? `${boardingPass.contentType ?? '이미지'} · ${boardingPass.byteSize ?? 0} bytes`
              : '아직 탑승권 이미지가 없어요.'}
          </Text>
          {boardingPass?.exists ? (
            <>
              <SecondaryButton
                disabled={opening}
                label={opening ? '여는 중...' : '탑승권 열기'}
                onPress={openBoardingPass}
              />
              <SecondaryButton
                disabled={uploading}
                label={uploading ? '교체 중...' : '탑승권 교체'}
                onPress={uploadBoardingPass}
              />
              <SecondaryButton
                disabled={deleting}
                label={deleting ? '삭제 중...' : '탑승권 삭제'}
                onPress={deleteBoardingPass}
              />
            </>
          ) : (
            <SecondaryButton
              disabled={uploading}
              label={uploading ? '올리는 중...' : '탑승권 추가'}
              onPress={uploadBoardingPass}
            />
          )}
        </Card>
      ) : (
        <Card>
          <Text style={styles.sectionTitle}>개인 정보 비공개</Text>
          <Text style={styles.helper}>이 항공편의 다른 탑승자 예약번호, 좌석, 탑승권은 표시되지 않아요.</Text>
        </Card>
      )}
    </TripScreen>
  );
}

function LabeledInput({ label, ...inputProps }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput placeholderTextColor={theme.color.textMuted} style={styles.input} {...inputProps} />
    </View>
  );
}

function personalDetailToDraft(detail: MyFlightPersonalDetail | null | undefined) {
  return {
    reservationNumber: detail?.reservationNumber ?? '',
    seat: detail?.seat ?? '',
    checkInUrl: detail?.checkInUrl ?? '',
  };
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function flightDetailErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '다시 로그인해주세요.';
    }
    if (error.status === 403 || error.status === 404) {
      return '삭제되었거나 접근할 수 없는 항공편이에요.';
    }
  }
  return '잠시 후 다시 시도해주세요.';
}

function participantsErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return '일정 참여자만 탑승자를 추가할 수 있어요.';
  }
  return '참여자 목록을 불러올 수 없어요. 잠시 후 다시 시도해주세요.';
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) {
    return '이 항공편의 탑승자만 개인 정보를 저장할 수 있어요.';
  }
  if (error instanceof ApiError && error.status === 400) {
    return '입력값을 다시 확인해주세요.';
  }
  return '저장할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function updateFlightErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return '공유 항공편 입력값을 다시 확인해주세요.';
    }
    if (error.status === 403) {
      return '일정 참여자만 공유 항공편 정보를 수정할 수 있어요.';
    }
    if (error.status === 404) {
      return '삭제되었거나 접근할 수 없는 항공편이에요.';
    }
  }
  return '공유 항공편 정보를 수정할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function addPassengersErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return '이미 탑승자이거나 현재 일정 참여자가 아니에요. 목록을 새로고침해 주세요.';
    }
    if (error.status === 403) {
      return '일정 참여자만 탑승자를 추가할 수 있어요.';
    }
    if (error.status === 404) {
      return '삭제되었거나 접근할 수 없는 항공편이에요.';
    }
    if (error.status === 400) {
      return '추가할 탑승자를 다시 선택해주세요.';
    }
  }
  return '탑승자를 추가할 수 없어요. 잠시 후 다시 시도해주세요.';
}

function openErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return '등록된 탑승권 이미지가 없어요.';
  }
  return '탑승권을 열 수 없어요. 잠시 후 다시 시도해주세요.';
}

function isSupportedBoardingPassImage(contentType: string): boolean {
  return contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp';
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof FlightUploadError) {
    if (error.status === 413) {
      return '탑승권 이미지는 10MB 이하만 올릴 수 있어요.';
    }
    if (error.status === 415) {
      return 'JPEG, PNG, WebP 이미지만 올릴 수 있어요.';
    }
    if (error.status === 503) {
      return '탑승권 저장소가 준비되지 않았어요. 잠시 후 다시 시도해주세요.';
    }
  }
  return '탑승권 이미지를 올릴 수 없어요. 잠시 후 다시 시도해주세요.';
}

const styles = StyleSheet.create({
  addPassengerName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  addPassengerRow: {
    alignItems: 'center',
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  addPassengerRowSelected: {
    backgroundColor: theme.color.surfaceSoft,
    borderColor: theme.color.uiAccent,
  },
  addPassengerState: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
  },
  addPassengerStateSelected: {
    color: theme.color.uiAccent,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    backgroundColor: theme.color.surfaceSoft,
  },
  divider: {
    backgroundColor: theme.color.borderSubtle,
    height: 1,
    width: '100%',
  },
  feedback: {
    color: theme.color.uiAccent,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  helper: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    lineHeight: theme.font.size.body * theme.font.leading.normal,
  },
  input: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  inputGroup: {
    gap: theme.space[2],
  },
  inputLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
  route: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  sectionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  subsectionTitle: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.bold,
  },
});
