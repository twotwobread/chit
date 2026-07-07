import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, type NonPlaceTransportMode } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../lib/auth/client';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../lib/design';
import { createGooglePlaceScheduleItem } from '../../../../../../lib/places/client';
import { isDuplicateDayPlaceConfirmationError } from '../../../../../../lib/places/google-search';
import {
  buildGooglePlaceSearchSelectorRoute,
  buildPlaceScheduleDetailSubmitState,
  clearSelectedPlaceFromPlaceScheduleForm,
  hasRequiredUnifiedScheduleDetailFields,
  parsePlaceScheduleDetailParams,
  placeScheduleFailureMessage,
  validateUnifiedScheduleDetailForm,
  type PlaceScheduleDetailFormErrors,
  type PlaceScheduleDetailFormValues,
} from '../../../../../../lib/places/place-schedule-detail';
import { createNonPlaceScheduleItem } from '../../../../../../lib/trips/itinerary-api';
import {
  nonPlaceCategoryOptions,
  nonPlaceTransportModeOptions,
} from '../../../../../../lib/trips/non-place-schedule-item';
import { tripItineraryDayPath, tripItineraryPath } from '../../../../../../lib/trips/routes';
import { ScheduleTimeEditor } from '../../../../../../lib/trip-ui/ScheduleTimeEditor';

export default function NewPlaceScheduleDetailScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    title: titleParam,
    titleTouched: titleTouchedParam,
    startTime: startTimeParam,
    endTime: endTimeParam,
    memo: memoParam,
    googlePlaceId: googlePlaceIdParam,
    placeName: placeNameParam,
    address: addressParam,
    typeHint: typeHintParam,
    nonPlaceCategory: nonPlaceCategoryParam,
    nonPlaceLink: nonPlaceLinkParam,
    nonPlaceTransportMode: nonPlaceTransportModeParam,
    nonPlaceReferenceNumber: nonPlaceReferenceNumberParam,
    nonPlaceBookingReference: nonPlaceBookingReferenceParam,
    nonPlaceOriginText: nonPlaceOriginTextParam,
    nonPlaceDestinationText: nonPlaceDestinationTextParam,
    nonPlaceTerminalText: nonPlaceTerminalTextParam,
    nonPlaceGateText: nonPlaceGateTextParam,
  } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
    title?: string | string[];
    titleTouched?: string | string[];
    startTime?: string | string[];
    endTime?: string | string[];
    memo?: string | string[];
    googlePlaceId?: string | string[];
    placeName?: string | string[];
    address?: string | string[];
    typeHint?: string | string[];
    nonPlaceCategory?: string | string[];
    nonPlaceLink?: string | string[];
    nonPlaceTransportMode?: string | string[];
    nonPlaceReferenceNumber?: string | string[];
    nonPlaceBookingReference?: string | string[];
    nonPlaceOriginText?: string | string[];
    nonPlaceDestinationText?: string | string[];
    nonPlaceTerminalText?: string | string[];
    nonPlaceGateText?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const [values, setValues] = useState<PlaceScheduleDetailFormValues>(() =>
    parsePlaceScheduleDetailParams({
      title: titleParam,
      titleTouched: titleTouchedParam,
      startTime: startTimeParam,
      endTime: endTimeParam,
      memo: memoParam,
      googlePlaceId: googlePlaceIdParam,
      placeName: placeNameParam,
      address: addressParam,
      typeHint: typeHintParam,
      nonPlaceCategory: nonPlaceCategoryParam,
      nonPlaceLink: nonPlaceLinkParam,
      nonPlaceTransportMode: nonPlaceTransportModeParam,
      nonPlaceReferenceNumber: nonPlaceReferenceNumberParam,
      nonPlaceBookingReference: nonPlaceBookingReferenceParam,
      nonPlaceOriginText: nonPlaceOriginTextParam,
      nonPlaceDestinationText: nonPlaceDestinationTextParam,
      nonPlaceTerminalText: nonPlaceTerminalTextParam,
      nonPlaceGateText: nonPlaceGateTextParam,
    }),
  );
  const [errors, setErrors] = useState<PlaceScheduleDetailFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ title: string; helper: string } | null>(null);
  const [duplicateConfirmation, setDuplicateConfirmation] = useState<string | null>(null);

  useEffect(() => {
    setValues(
      parsePlaceScheduleDetailParams({
        title: titleParam,
        titleTouched: titleTouchedParam,
        startTime: startTimeParam,
        endTime: endTimeParam,
        memo: memoParam,
        googlePlaceId: googlePlaceIdParam,
        placeName: placeNameParam,
        address: addressParam,
        typeHint: typeHintParam,
        nonPlaceCategory: nonPlaceCategoryParam,
        nonPlaceLink: nonPlaceLinkParam,
        nonPlaceTransportMode: nonPlaceTransportModeParam,
        nonPlaceReferenceNumber: nonPlaceReferenceNumberParam,
        nonPlaceBookingReference: nonPlaceBookingReferenceParam,
        nonPlaceOriginText: nonPlaceOriginTextParam,
        nonPlaceDestinationText: nonPlaceDestinationTextParam,
        nonPlaceTerminalText: nonPlaceTerminalTextParam,
        nonPlaceGateText: nonPlaceGateTextParam,
      }),
    );
    setErrors({});
    setFailure(null);
    setDuplicateConfirmation(null);
  }, [
    addressParam,
    endTimeParam,
    googlePlaceIdParam,
    memoParam,
    nonPlaceBookingReferenceParam,
    nonPlaceCategoryParam,
    nonPlaceDestinationTextParam,
    nonPlaceGateTextParam,
    nonPlaceLinkParam,
    nonPlaceOriginTextParam,
    nonPlaceReferenceNumberParam,
    nonPlaceTerminalTextParam,
    nonPlaceTransportModeParam,
    placeNameParam,
    startTimeParam,
    titleParam,
    titleTouchedParam,
    typeHintParam,
  ]);

  const backToDay = () => {
    if (tripId && date) {
      router.replace(tripItineraryDayPath(tripId, date));
      return;
    }
    if (tripId) {
      router.replace(tripItineraryPath(tripId));
      return;
    }
    router.replace('/');
  };

  const updateValues = (patch: Partial<PlaceScheduleDetailFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors({});
    setFailure(null);
    setDuplicateConfirmation(null);
  };

  const clearSelectedPlace = () => {
    setValues((current) => clearSelectedPlaceFromPlaceScheduleForm(current));
    setErrors({});
    setFailure(null);
    setDuplicateConfirmation(null);
  };

  const openPlaceSearch = () => {
    if (!tripId || !date || isSubmitting) {
      return;
    }
    router.push(buildGooglePlaceSearchSelectorRoute(tripId, date, values));
  };

  const submit = async (duplicateConfirmed: boolean) => {
    if (!tripId || !date || isSubmitting) {
      return;
    }
    const validation = validateUnifiedScheduleDetailForm(values, duplicateConfirmed);
    if (!validation.ok) {
      setErrors(validation.errors);
      setFailure(null);
      setDuplicateConfirmation(null);
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setFailure(null);
    try {
      if (validation.kind === 'place') {
        await createGooglePlaceScheduleItem(tripId, date, validation.request);
      } else {
        await createNonPlaceScheduleItem(tripId, date, validation.request);
      }
      backToDay();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          router.replace('/login');
          return;
        }
        if (validation.kind === 'place' && error.status === 409 && isDuplicateDayPlaceConfirmationError(error.body)) {
          setDuplicateConfirmation('이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?');
          return;
        }
        setFailure(placeScheduleFailureMessage(error.status));
        return;
      }
      setFailure(placeScheduleFailureMessage());
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitView = buildPlaceScheduleDetailSubmitState(isSubmitting, hasRequiredUnifiedScheduleDetailFields(values));

  if (!tripId || !date) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <Card>
          <Text style={styles.errorTitle}>일정을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행 일정이에요.</Text>
          <PrimaryButton label="일정으로" onPress={backToDay} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>일정 상세 입력</Text>
        <Text style={styles.screenHelper}>장소를 검색하거나, 장소 없이 카테고리만 선택해 저장할 수 있어요.</Text>
      </View>

      <Card>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>장소</Text>
          {values.selectedPlace ? (
            <View style={styles.placeCard}>
              <View style={styles.placeHeader}>
                <Text style={styles.placeName}>{values.selectedPlace.placeName}</Text>
                <Text style={styles.placeType}>{values.selectedPlace.typeHint}</Text>
              </View>
              <Text style={styles.placeAddress}>{values.selectedPlace.address}</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>장소 없이 저장해도 괜찮아요. 장소가 필요한 일정이면 검색해 주세요.</Text>
          )}
          {errors.place ? <Text style={styles.fieldError}>{errors.place}</Text> : null}
          <PrimaryButton
            disabled={isSubmitting}
            label={values.selectedPlace ? '장소 다시 검색' : '장소 검색'}
            onPress={openPlaceSearch}
          />
          {values.selectedPlace ? (
            <SecondaryButton disabled={isSubmitting} label="장소 지우기" onPress={clearSelectedPlace} />
          ) : null}
        </View>

        {!values.selectedPlace ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>카테고리</Text>
            <View style={styles.chipList}>
              {nonPlaceCategoryOptions.map((option) => {
                const selected = values.nonPlaceCategory === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSubmitting}
                    key={option.value}
                    onPress={() => updateValues({ nonPlaceCategory: option.value })}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.nonPlaceCategory ? <Text style={styles.fieldError}>{errors.nonPlaceCategory}</Text> : null}
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>일정 제목</Text>
          <TextInput
            editable={!isSubmitting}
            onChangeText={(title) => updateValues({ title, titleTouched: true })}
            placeholder="예: 도톤보리 산책"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={values.title}
          />
          {errors.title ? <Text style={styles.fieldError}>{errors.title}</Text> : null}
        </View>

        <ScheduleTimeEditor
          disabled={isSubmitting}
          emptyHelper="시간을 정하지 않으면 시간 미정 일정으로 저장돼요."
          endTimeError={errors.endTime}
          helper="종료 시간은 선택 사항이에요. 필요 없으면 시간 미정을 눌러 비울 수 있어요."
          onChange={updateValues}
          startTimeError={errors.startTime}
          values={values}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>메모</Text>
          <TextInput
            editable={!isSubmitting}
            multiline
            onChangeText={(memo) => updateValues({ memo })}
            placeholder="선택 입력"
            placeholderTextColor={theme.color.textFaint}
            style={[styles.input, styles.memoInput]}
            textAlignVertical="top"
            value={values.memo}
          />
          {errors.memo ? <Text style={styles.fieldError}>{errors.memo}</Text> : null}
        </View>

        {!values.selectedPlace ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>링크</Text>
              <TextInput
                autoCapitalize="none"
                editable={!isSubmitting}
                keyboardType="url"
                onChangeText={(nonPlaceLink) => updateValues({ nonPlaceLink })}
                placeholder="https://..."
                placeholderTextColor={theme.color.textFaint}
                style={styles.input}
                value={values.nonPlaceLink}
              />
              {errors.nonPlaceLink ? <Text style={styles.fieldError}>{errors.nonPlaceLink}</Text> : null}
            </View>

            {values.nonPlaceCategory === 'transport' ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>이동 수단</Text>
                  <View style={styles.chipList}>
                    {nonPlaceTransportModeOptions.map((option) => {
                      const selected = values.nonPlaceTransportMode === option.value;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSubmitting}
                          key={option.value}
                          onPress={() => updateValues({ nonPlaceTransportMode: option.value as NonPlaceTransportMode })}
                          style={[styles.chip, selected ? styles.chipSelected : null]}
                        >
                          <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.nonPlaceTransportMode ? (
                    <Text style={styles.fieldError}>{errors.nonPlaceTransportMode}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>출발/도착</Text>
                  <View style={styles.inputGrid}>
                    <View style={styles.inputGridItem}>
                      <TextInput
                        editable={!isSubmitting}
                        onChangeText={(nonPlaceOriginText) => updateValues({ nonPlaceOriginText })}
                        placeholder="출발지"
                        placeholderTextColor={theme.color.textFaint}
                        style={styles.input}
                        value={values.nonPlaceOriginText}
                      />
                      {errors.nonPlaceOriginText ? (
                        <Text style={styles.fieldError}>{errors.nonPlaceOriginText}</Text>
                      ) : null}
                    </View>
                    <View style={styles.inputGridItem}>
                      <TextInput
                        editable={!isSubmitting}
                        onChangeText={(nonPlaceDestinationText) => updateValues({ nonPlaceDestinationText })}
                        placeholder="도착지"
                        placeholderTextColor={theme.color.textFaint}
                        style={styles.input}
                        value={values.nonPlaceDestinationText}
                      />
                      {errors.nonPlaceDestinationText ? (
                        <Text style={styles.fieldError}>{errors.nonPlaceDestinationText}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>예약/탑승 정보</Text>
                  <TextInput
                    editable={!isSubmitting}
                    onChangeText={(nonPlaceReferenceNumber) => updateValues({ nonPlaceReferenceNumber })}
                    placeholder="편명/열차번호"
                    placeholderTextColor={theme.color.textFaint}
                    style={styles.input}
                    value={values.nonPlaceReferenceNumber}
                  />
                  {errors.nonPlaceReferenceNumber ? (
                    <Text style={styles.fieldError}>{errors.nonPlaceReferenceNumber}</Text>
                  ) : null}
                  <TextInput
                    editable={!isSubmitting}
                    onChangeText={(nonPlaceBookingReference) => updateValues({ nonPlaceBookingReference })}
                    placeholder="예약번호"
                    placeholderTextColor={theme.color.textFaint}
                    style={styles.input}
                    value={values.nonPlaceBookingReference}
                  />
                  {errors.nonPlaceBookingReference ? (
                    <Text style={styles.fieldError}>{errors.nonPlaceBookingReference}</Text>
                  ) : null}
                  <View style={styles.inputGrid}>
                    <View style={styles.inputGridItem}>
                      <TextInput
                        editable={!isSubmitting}
                        onChangeText={(nonPlaceTerminalText) => updateValues({ nonPlaceTerminalText })}
                        placeholder="터미널"
                        placeholderTextColor={theme.color.textFaint}
                        style={styles.input}
                        value={values.nonPlaceTerminalText}
                      />
                      {errors.nonPlaceTerminalText ? (
                        <Text style={styles.fieldError}>{errors.nonPlaceTerminalText}</Text>
                      ) : null}
                    </View>
                    <View style={styles.inputGridItem}>
                      <TextInput
                        editable={!isSubmitting}
                        onChangeText={(nonPlaceGateText) => updateValues({ nonPlaceGateText })}
                        placeholder="게이트"
                        placeholderTextColor={theme.color.textFaint}
                        style={styles.input}
                        value={values.nonPlaceGateText}
                      />
                      {errors.nonPlaceGateText ? (
                        <Text style={styles.fieldError}>{errors.nonPlaceGateText}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {duplicateConfirmation ? (
          <View style={styles.noticeBox}>
            <Text style={styles.errorTitle}>이미 추가된 장소예요.</Text>
            <Text style={styles.message}>{duplicateConfirmation}</Text>
            <PrimaryButton
              disabled={isSubmitting}
              label="한 번 더 추가"
              loading={isSubmitting}
              loadingLabel="저장 중..."
              onPress={() => void submit(true)}
            />
          </View>
        ) : null}

        {failure ? (
          <View style={styles.noticeBox}>
            <Text style={styles.errorTitle}>{failure.title}</Text>
            <Text style={styles.message}>{failure.helper}</Text>
          </View>
        ) : null}

        <View style={styles.actionGroup}>
          <PrimaryButton
            disabled={submitView.disabled}
            label={submitView.label}
            loading={isSubmitting}
            loadingLabel={submitView.label}
            onPress={() => void submit(false)}
          />
          <SecondaryButton disabled={isSubmitting} label="일정으로 돌아가기" onPress={backToDay} />
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
    gap: theme.space[3],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  screenHelper: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    textAlign: 'center',
  },
  fieldGroup: {
    gap: theme.space[2],
  },
  label: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  input: {
    minHeight: theme.layout.controlH,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
    paddingHorizontal: theme.space[4],
  },
  memoInput: {
    minHeight: 88,
    paddingTop: theme.space[4],
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.label,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  chip: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[2],
  },
  chipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  chipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  chipTextSelected: {
    color: theme.color.primary,
  },
  inputGrid: {
    flexDirection: 'row',
    gap: theme.space[3],
  },
  inputGridItem: {
    flex: 1,
    gap: theme.space[2],
  },
  placeCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  placeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  placeName: {
    color: theme.color.textStrong,
    flexShrink: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  placeType: {
    color: theme.color.primary,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  placeAddress: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  noticeBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  message: {
    color: theme.color.textBody,
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
  actionGroup: {
    gap: theme.space[3],
  },
});
