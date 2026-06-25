import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ApiError, type TripPlaceType } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../lib/auth/client';
import { theme } from '../../../../../../lib/design';
import { buildDayItineraryRoute } from '../../../../../../lib/trips/day-itinerary';
import { createManualDayItineraryItem } from '../../../../../../lib/trips/client';
import {
  buildManualPlaceSubmitState,
  manualPlaceFailureState,
  manualPlaceTypeOptions,
  validateManualPlaceForm,
  type ManualPlaceFormErrors,
  type ManualPlaceFormValues,
} from '../../../../../../lib/trips/manual-place';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'auth' }
  | { status: 'notFound'; title: string; helper: string }
  | { status: 'error'; title: string; helper: string };

export default function NewManualPlaceScreen() {
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{
    tripId?: string | string[];
    date?: string | string[];
  }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const [values, setValues] = useState<ManualPlaceFormValues>({ name: '', address: '', placeType: undefined });
  const [errors, setErrors] = useState<ManualPlaceFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const isSubmitting = submitState.status === 'submitting';
  const submitView = buildManualPlaceSubmitState(isSubmitting);

  const backToDay = () => {
    if (tripId && date) {
      router.replace(buildDayItineraryRoute(tripId, date));
      return;
    }
    router.replace('/');
  };

  const submit = async () => {
    if (isSubmitting) {
      return;
    }
    if (!tripId || !date) {
      const failure = manualPlaceFailureState(404);
      setSubmitState({ status: 'notFound', title: failure.title, helper: failure.helper });
      return;
    }

    const validation = validateManualPlaceForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      setSubmitState({ status: 'idle' });
      return;
    }

    setErrors({});
    setSubmitState({ status: 'submitting' });
    try {
      await createManualDayItineraryItem(tripId, date, validation.request);
      router.replace(buildDayItineraryRoute(tripId, date));
    } catch (error) {
      if (
        error instanceof MobileAuthError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')
      ) {
        setSubmitState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setSubmitState({ status: 'auth' });
          return;
        }
        if (error.status === 400) {
          setSubmitState({
            status: 'error',
            title: '입력값을 확인해주세요.',
            helper: '장소명, 주소, 타입을 다시 확인해주세요.',
          });
          return;
        }
        const failure = manualPlaceFailureState(error.status);
        if (failure.status === 'notFound') {
          setSubmitState({ status: 'notFound', title: failure.title, helper: failure.helper });
          return;
        }
        setSubmitState({ status: 'error', title: failure.title, helper: failure.helper });
        return;
      }
      const failure = manualPlaceFailureState();
      setSubmitState({ status: 'error', title: failure.title, helper: failure.helper });
    }
  };

  if (!tripId || !date || submitState.status === 'notFound') {
    const title = submitState.status === 'notFound' ? submitState.title : manualPlaceFailureState(404).title;
    const helper = submitState.status === 'notFound' ? submitState.helper : manualPlaceFailureState(404).helper;
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>장소 직접 추가</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.message}>{helper}</Text>
          <Pressable accessibilityRole="button" onPress={backToDay} style={styles.button}>
            <Text style={styles.buttonText}>여행 상세로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (submitState.status === 'auth') {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>장소 직접 추가</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
            <Text style={styles.buttonText}>로그인하기</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>장소 직접 추가</Text>
        <Text style={styles.screenHelper}>이 Day에 방문할 장소를 직접 입력해요.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>장소명</Text>
          <TextInput
            editable={!isSubmitting}
            onChangeText={(name) => setValues((current) => ({ ...current, name }))}
            placeholder="예: 우메다 공중정원"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={values.name}
          />
          {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>주소</Text>
          <TextInput
            editable={!isSubmitting}
            multiline
            onChangeText={(address) => setValues((current) => ({ ...current, address }))}
            placeholder="예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
            placeholderTextColor={theme.color.textFaint}
            style={[styles.input, styles.addressInput]}
            textAlignVertical="top"
            value={values.address}
          />
          {errors.address ? <Text style={styles.fieldError}>{errors.address}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>장소 타입</Text>
          <View style={styles.chipList}>
            {manualPlaceTypeOptions.map((option) => {
              const selected = values.placeType === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  key={option.value}
                  onPress={() => setValues((current) => ({ ...current, placeType: option.value as TripPlaceType }))}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.placeType ? <Text style={styles.fieldError}>{errors.placeType}</Text> : null}
        </View>

        {submitState.status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{submitState.title}</Text>
            <Text style={styles.message}>{submitState.helper}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitView.disabled}
          onPress={() => void submit()}
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
          <Text style={styles.secondaryButtonText}>Day 일정으로</Text>
        </Pressable>
      </View>
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
    justifyContent: 'center',
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
    color: theme.color.textMuted,
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
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textStrong,
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
    fontSize: theme.font.size.body,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  addressInput: {
    minHeight: theme.layout.controlHLg,
  },
  fieldError: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  chip: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
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
  errorBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
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
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
});
