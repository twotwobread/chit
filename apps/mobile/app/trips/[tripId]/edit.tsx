import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError } from '@i-um/api-contract';

import { MobileAuthError } from '../../../lib/auth/client';
import { getStoredSession } from '../../../lib/auth/session';
import {
  Card,
  ChoiceChip,
  FormField,
  PrimaryButton,
  ScreenBackground,
  SecondaryButton,
  TextInputField,
  theme,
} from '../../../lib/design';
import { KeyboardAwareFormScrollView } from '../../../lib/trip-ui/KeyboardAwareFormScrollView';
import { StickyActionFooter, useStickyActionFooterLayout } from '../../../lib/trip-ui/StickyActionFooter';
import { updateTrip } from '../../../lib/trips/trip-api';
import { dateFromString, monthStringFromDate, todayString } from '../../../lib/trips/date';
import { tripDetailPath } from '../../../lib/trips/routes';
import { resolveTripShellDetail } from '../../../lib/trips/trip-shell-detail';
import { useTripShellState } from '../../../lib/trips/trip-shell-context';
import { TripDateFieldButton, TripDatePicker } from '../../../lib/trips/date-picker';
import {
  buildUpdateTripRequest,
  canSubmitTripBasicInfoUpdate,
  supportedCurrencies,
  tripToBasicInfoForm,
  validateTripBasicInfoForm,
  type TripBasicInfoForm,
} from '../../../lib/trips/update-form';
import { buildTripDefaultTravelModeSelectorViewModel } from '../../../lib/trips/travel-mode';

type DateField = 'startDate' | 'endDate';
type LoadState = 'loading' | 'ready' | 'auth' | 'notFound' | 'error';
const yearOptionRadius = 5;

export default function EditTripScreen() {
  const { tripId: tripIdParam } = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const shellState = useTripShellState();
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

    const shellDetail = resolveTripShellDetail(shellState, tripId);
    if (shellDetail.status === 'pending') {
      return;
    }
    if (shellDetail.status !== 'success') {
      setLoadState(editTripShellFailureState(shellDetail.status));
      return;
    }

    try {
      const detail = shellDetail.detail;
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
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
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
  }, [shellState, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validationError = form ? validateTripBasicInfoForm(form) : null;
  const canSave = form ? canSubmitTripBasicInfoUpdate({ original, current: form, submitting }) : false;
  const footerLayout = useStickyActionFooterLayout({ actionCount: 2 });

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

  const returnToDetail = () => {
    if (!tripId) {
      router.replace('/');
      return;
    }
    router.replace(tripDetailPath(tripId));
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
      returnToDetail();
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
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
    <ScreenBackground style={styles.screenRoot}>
      <KeyboardAwareFormScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardFixedBottomOffset={footerLayout.keyboardFixedBottomOffset}
        keyboardMinClearance={footerLayout.keyboardMinClearance}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.title}>여행 정보 수정</Text>
          <Text style={styles.subtitle}>이름, 기간, 기본 통화와 이동 방식을 바꿀 수 있어요.</Text>
        </View>

        {loadState === 'loading' ? (
          <Card>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>여행 정보를 불러오는 중...</Text>
          </Card>
        ) : null}

        {loadState === 'auth' ? (
          <Card>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
          </Card>
        ) : null}

        {loadState === 'notFound' ? (
          <Card>
            <Text style={styles.errorTitle}>여행을 찾을 수 없어요.</Text>
            <Text style={styles.message}>삭제되었거나 접근할 수 없는 여행이에요.</Text>
            <PrimaryButton label="홈으로" onPress={() => router.replace('/')} />
          </Card>
        ) : null}

        {loadState === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>여행 정보를 불러올 수 없어요.</Text>
            <Text style={styles.message}>잠시 후 다시 시도해주세요.</Text>
            <PrimaryButton label="다시 시도" onPress={() => void load()} />
          </Card>
        ) : null}

        {loadState === 'ready' && form ? (
          <Card>
            <TextInputField
              disabled={submitting}
              label="여행 이름"
              onChangeText={(name) => {
                setForm((current) => (current ? { ...current, name } : current));
                setSaveError(null);
              }}
              placeholder="예: 오사카 3박 4일"
              required
              value={form.name}
            />

            <FormField disabled={submitting} label="시작일" required>
              <TripDateFieldButton
                disabled={submitting}
                onPress={() => openDatePicker('startDate')}
                value={form.startDate}
              />
            </FormField>

            <FormField disabled={submitting} label="종료일" required>
              <TripDateFieldButton
                disabled={submitting}
                onPress={() => openDatePicker('endDate')}
                value={form.endDate}
              />
            </FormField>

            {activeDateField ? (
              <TripDatePicker
                helperText="기간은 시작일이 종료일보다 늦지 않게 저장돼요."
                label={activeDateField === 'startDate' ? '시작일 선택' : '종료일 선택'}
                month={calendarMonth}
                onClose={() => setActiveDateField(null)}
                onMonthChange={setCalendarMonth}
                onSelect={selectDate}
                selectedDate={activeDateField === 'startDate' ? form.startDate : form.endDate}
                yearOptionRadius={yearOptionRadius}
              />
            ) : null}

            <FormField label="기본 통화" disabled={submitting}>
              <View style={styles.currencyRow}>
                {supportedCurrencies.map((currency) => {
                  const selected = form.defaultCurrency === currency;
                  return (
                    <ChoiceChip
                      disabled={submitting}
                      key={currency}
                      label={currency}
                      onPress={() => {
                        setForm((current) => (current ? { ...current, defaultCurrency: currency } : current));
                        setSaveError(null);
                      }}
                      selected={selected}
                    />
                  );
                })}
              </View>
            </FormField>

            <FormField
              disabled={submitting}
              helperText="일정 이동 시간 계산에 기본으로 사용할 방식을 선택해요."
              label="이동 방식"
            >
              <View style={styles.currencyRow}>
                {buildTripDefaultTravelModeSelectorViewModel(form.defaultTravelMode).options.map((option) => (
                  <ChoiceChip
                    accessibilityLabel={option.accessibilityLabel}
                    disabled={submitting}
                    key={option.mode}
                    label={option.label}
                    onPress={() => {
                      setForm((current) => (current ? { ...current, defaultTravelMode: option.mode } : current));
                      setSaveError(null);
                    }}
                    selected={option.selected}
                  />
                ))}
              </View>
            </FormField>

            {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
            {!validationError && original && !canSave ? (
              <Text style={styles.helperText}>변경된 내용이 없어요.</Text>
            ) : null}
            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          </Card>
        ) : null}
      </KeyboardAwareFormScrollView>
      {loadState === 'ready' && form ? (
        <StickyActionFooter actionCount={2} layout={footerLayout}>
          <PrimaryButton
            disabled={!canSave}
            label="저장하기"
            loading={submitting}
            loadingLabel="저장하는 중..."
            onPress={() => void submit()}
          />
          <SecondaryButton disabled={submitting} label="취소" onPress={returnToDetail} />
        </StickyActionFooter>
      ) : null}
    </ScreenBackground>
  );
}

function editTripShellFailureState(status: 'auth' | 'notFound' | 'error'): LoadState {
  return status;
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
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
    color: theme.color.textOnShell,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    marginBottom: theme.space[3],
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textOnShellMuted,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
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
    backgroundColor: theme.color.primary,
    borderColor: theme.color.primary,
  },
  currencyText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  currencyTextSelected: {
    color: theme.color.onPrimary,
  },
  helperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    textAlign: 'center',
  },
  fieldHelperText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    lineHeight: 20,
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
  disabledButton: {
    opacity: 0.5,
  },
});
