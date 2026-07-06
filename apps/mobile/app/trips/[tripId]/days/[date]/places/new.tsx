import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../lib/auth/client';
import { theme } from '../../../../../../lib/design';
import { createGooglePlaceScheduleItem } from '../../../../../../lib/places/client';
import { isDuplicateDayPlaceConfirmationError } from '../../../../../../lib/places/google-search';
import {
  buildGooglePlaceSearchSelectorRoute,
  buildPlaceScheduleDetailSubmitState,
  buildScheduleTimeText,
  defaultEndScheduleTimeFromStart,
  defaultScheduleTimeFromDate,
  hasRequiredPlaceScheduleDetailFields,
  parsePlaceScheduleDetailParams,
  parseScheduleTimePickerValue,
  placeScheduleFailureMessage,
  scheduleTimeHourOptions,
  scheduleTimeMinuteOptions,
  scheduleTimePeriodOptions,
  validatePlaceScheduleDetailForm,
  type PlaceScheduleDetailFormErrors,
  type PlaceScheduleDetailFormValues,
  type PlaceScheduleTimePeriod,
  type PlaceScheduleTimePickerValue,
} from '../../../../../../lib/places/place-schedule-detail';
import { tripItineraryDayPath, tripItineraryPath } from '../../../../../../lib/trips/routes';

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

  const openPlaceSearch = () => {
    if (!tripId || !date || isSubmitting) {
      return;
    }
    router.push(buildGooglePlaceSearchSelectorRoute(tripId, date, values));
  };

  const addStartTime = () => {
    updateValues({ startTime: defaultScheduleTimeFromDate() });
  };

  const clearTimes = () => {
    updateValues({ startTime: '', endTime: '' });
  };

  const updateStartTime = (patch: Partial<PlaceScheduleTimePickerValue>) => {
    const current = parseScheduleTimePickerValue(values.startTime || defaultScheduleTimeFromDate());
    updateValues({ startTime: buildScheduleTimeText({ ...current, ...patch }) });
  };

  const addEndTime = () => {
    const endTime = defaultEndScheduleTimeFromStart(values.startTime);
    if (endTime) {
      updateValues({ endTime });
    }
  };

  const updateEndTime = (patch: Partial<PlaceScheduleTimePickerValue>) => {
    const fallbackEndTime =
      defaultEndScheduleTimeFromStart(values.startTime) || values.startTime || defaultScheduleTimeFromDate();
    const current = parseScheduleTimePickerValue(values.endTime || fallbackEndTime);
    updateValues({ endTime: buildScheduleTimeText({ ...current, ...patch }) });
  };

  const submit = async (duplicateConfirmed: boolean) => {
    if (!tripId || !date || isSubmitting) {
      return;
    }
    const validation = validatePlaceScheduleDetailForm(values, duplicateConfirmed);
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
      await createGooglePlaceScheduleItem(tripId, date, validation.request);
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
        if (error.status === 409 && isDuplicateDayPlaceConfirmationError(error.body)) {
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

  const submitView = buildPlaceScheduleDetailSubmitState(isSubmitting, hasRequiredPlaceScheduleDetailFields(values));

  if (!tripId || !date) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.errorTitle}>일정을 찾을 수 없어요.</Text>
          <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행 일정이에요.</Text>
          <Pressable accessibilityRole="button" onPress={backToDay} style={styles.button}>
            <Text style={styles.buttonText}>일정으로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>일정 상세 입력</Text>
        <Text style={styles.screenHelper}>장소와 제목만 정해도 시간 미정 일정으로 저장할 수 있어요.</Text>
      </View>

      <View style={styles.card}>
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
            <Text style={styles.helperText}>일정에 연결할 장소를 검색해 주세요.</Text>
          )}
          {errors.place ? <Text style={styles.fieldError}>{errors.place}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={openPlaceSearch}
            style={[styles.placeSearchButton, isSubmitting ? styles.buttonDisabled : null]}
          >
            <Text style={styles.placeSearchButtonText}>{values.selectedPlace ? '장소 다시 검색' : '장소 검색'}</Text>
          </Pressable>
        </View>

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

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.label}>시간</Text>
            {values.startTime ? (
              <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={clearTimes}>
                <Text style={styles.inlineActionText}>시간 미정</Text>
              </Pressable>
            ) : null}
          </View>

          {values.startTime ? (
            <View style={styles.timePickerStack}>
              <ScheduleTimeWheel
                disabled={isSubmitting}
                label="시작 시간"
                onChange={updateStartTime}
                value={values.startTime}
              />
              {errors.startTime ? <Text style={styles.fieldError}>{errors.startTime}</Text> : null}

              {values.endTime ? (
                <ScheduleTimeWheel
                  disabled={isSubmitting}
                  label="종료 시간"
                  onChange={updateEndTime}
                  value={values.endTime}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting || defaultEndScheduleTimeFromStart(values.startTime).length === 0}
                  onPress={addEndTime}
                  style={[
                    styles.secondaryButton,
                    isSubmitting || defaultEndScheduleTimeFromStart(values.startTime).length === 0
                      ? styles.secondaryButtonDisabled
                      : null,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>종료 시간 추가</Text>
                </Pressable>
              )}
              {errors.endTime ? <Text style={styles.fieldError}>{errors.endTime}</Text> : null}
              <Text style={styles.helperText}>
                종료 시간은 선택 사항이에요. 필요 없으면 시간 미정을 눌러 비울 수 있어요.
              </Text>
            </View>
          ) : (
            <View style={styles.timeEmptyBox}>
              <Text style={styles.helperText}>시간을 정하지 않으면 시간 미정 일정으로 저장돼요.</Text>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={addStartTime}
                style={[styles.secondaryButton, isSubmitting ? styles.secondaryButtonDisabled : null]}
              >
                <Text style={styles.secondaryButtonText}>시간 추가</Text>
              </Pressable>
            </View>
          )}
        </View>

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

        {duplicateConfirmation ? (
          <View style={styles.noticeBox}>
            <Text style={styles.errorTitle}>이미 추가된 장소예요.</Text>
            <Text style={styles.message}>{duplicateConfirmation}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => void submit(true)}
              style={[styles.button, isSubmitting ? styles.buttonDisabled : null]}
            >
              {isSubmitting ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
              <Text style={styles.buttonText}>{isSubmitting ? '저장 중...' : '한 번 더 추가'}</Text>
            </Pressable>
          </View>
        ) : null}

        {failure ? (
          <View style={styles.noticeBox}>
            <Text style={styles.errorTitle}>{failure.title}</Text>
            <Text style={styles.message}>{failure.helper}</Text>
          </View>
        ) : null}

        <View style={styles.actionGroup}>
          <Pressable
            accessibilityRole="button"
            disabled={submitView.disabled}
            onPress={() => void submit(false)}
            style={[styles.button, submitView.disabled ? styles.buttonDisabled : null]}
          >
            {isSubmitting ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
            <Text style={styles.buttonText}>{submitView.label}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={backToDay}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>일정으로 돌아가기</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const wheelItemHeight = 36;
const wheelVisibleItems = 4;

function ScheduleTimeWheel({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (patch: Partial<PlaceScheduleTimePickerValue>) => void;
  value: string;
}) {
  const pickerValue = parseScheduleTimePickerValue(value);

  return (
    <View style={styles.timeWheelCard}>
      <View style={styles.timeWheelHeader}>
        <Text style={styles.timeWheelLabel}>{label}</Text>
        <Text style={styles.timeWheelValue}>{formatScheduleTimeDisplay(pickerValue)}</Text>
      </View>
      <View style={styles.timeWheelRow}>
        <TimeWheelColumn<PlaceScheduleTimePeriod>
          disabled={disabled}
          labelForOption={formatPeriodOption}
          onChange={(period) => onChange({ period })}
          options={scheduleTimePeriodOptions}
          value={pickerValue.period}
        />
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(hour) => `${Number(hour)}시`}
          onChange={(hour) => onChange({ hour })}
          options={scheduleTimeHourOptions}
          value={pickerValue.hour}
        />
        <TimeWheelColumn
          disabled={disabled}
          labelForOption={(minute) => `${minute}분`}
          onChange={(minute) => onChange({ minute })}
          options={scheduleTimeMinuteOptions}
          value={pickerValue.minute}
        />
      </View>
    </View>
  );
}

function TimeWheelColumn<T extends string>({
  disabled,
  labelForOption,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  labelForOption: (option: T) => string;
  onChange: (option: T) => void;
  options: T[];
  value: T;
}) {
  const selectedIndex = Math.max(0, options.indexOf(value));
  const selectByOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (disabled) {
      return;
    }
    const index = Math.max(
      0,
      Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / wheelItemHeight)),
    );
    onChange(options[index]);
  };

  return (
    <View style={styles.timeWheelColumn}>
      <ScrollView
        contentOffset={{ x: 0, y: selectedIndex * wheelItemHeight }}
        decelerationRate="fast"
        key={value}
        nestedScrollEnabled
        onMomentumScrollEnd={selectByOffset}
        showsVerticalScrollIndicator={false}
        snapToInterval={wheelItemHeight}
        style={styles.timeWheelList}
      >
        {options.map((item) => {
          const selected = item === value;
          return (
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              key={item}
              onPress={() => onChange(item)}
              style={[styles.timeWheelOption, selected ? styles.timeWheelOptionSelected : null]}
            >
              <Text style={[styles.timeWheelOptionText, selected ? styles.timeWheelOptionTextSelected : null]}>
                {labelForOption(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function formatPeriodOption(period: PlaceScheduleTimePeriod): string {
  return period === 'AM' ? '오전' : '오후';
}

function formatScheduleTimeDisplay(value: PlaceScheduleTimePickerValue): string {
  return `${formatPeriodOption(value.period)} ${Number(value.hour)}:${value.minute}`;
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
  fieldGroup: {
    gap: theme.space[2],
  },
  fieldHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
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
  inlineActionText: {
    color: theme.color.textLink,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  timeEmptyBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  timePickerStack: {
    gap: theme.space[3],
  },
  timeWheelCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[4],
  },
  timeWheelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  timeWheelLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  timeWheelValue: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  timeWheelRow: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  timeWheelColumn: {
    flex: 1,
    height: wheelItemHeight * wheelVisibleItems,
    overflow: 'hidden',
  },
  timeWheelList: {
    borderRadius: theme.radius.md,
  },
  timeWheelOption: {
    alignItems: 'center',
    height: wheelItemHeight,
    justifyContent: 'center',
  },
  timeWheelOptionSelected: {
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.sm,
  },
  timeWheelOptionText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  timeWheelOptionTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
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
  button: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    gap: theme.space[3],
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  buttonDisabled: {
    backgroundColor: theme.color.textFaint,
  },
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  placeSearchButton: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  placeSearchButtonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.color.surface,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
  },
  secondaryButtonDisabled: {
    backgroundColor: theme.color.surfaceSunken,
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
});
