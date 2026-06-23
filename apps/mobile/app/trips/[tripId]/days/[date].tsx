import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { ApiError, type TripPlaceType } from '@i-um/api-contract';

import { MobileAuthError } from '../../../../lib/auth/client';
import { theme } from '../../../../lib/design';
import {
  buildDayItineraryViewModel,
  dayItineraryFailureState,
  type DayItineraryRowViewModel,
  type DayItineraryViewModel,
} from '../../../../lib/trips/day-itinerary';
import {
  buildDayItineraryDeleteConfirmation,
  buildDayItineraryDeleteSubmitState,
  buildDayItineraryEditForm,
  buildDayItineraryEditSubmitState,
  dayItineraryMutationFailureState,
  validateDayItineraryEditForm,
  type DayItineraryEditFormErrors,
  type DayItineraryEditFormValues,
} from '../../../../lib/trips/day-itinerary-edit';
import { buildManualPlaceRoute, manualPlaceTypeOptions } from '../../../../lib/trips/manual-place';
import { buildGooglePlaceSearchRoute } from '../../../../lib/places/google-search';
import { deleteDayItineraryItem, getTripDayItinerary, updateDayItineraryItem } from '../../../../lib/trips/client';

type DayItineraryState =
  | { status: 'loading' }
  | { status: 'success'; viewModel: DayItineraryViewModel }
  | { status: 'auth' }
  | { status: 'notFound'; title: string; helper: string }
  | { status: 'error'; title: string; helper: string };

type EditState =
  | { status: 'idle' }
  | {
      status: 'editing' | 'saving';
      item: DayItineraryRowViewModel;
      original: DayItineraryEditFormValues;
      values: DayItineraryEditFormValues;
      errors: DayItineraryEditFormErrors;
      error?: { title: string; helper: string };
    };

type DeleteState =
  | { status: 'idle' }
  | { status: 'confirming' | 'deleting'; item: DayItineraryRowViewModel; error?: { title: string; helper: string } };

export default function TripDayItineraryScreen() {
  const { tripId: tripIdParam, date: dateParam } = useLocalSearchParams<{ tripId?: string | string[]; date?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const [state, setState] = useState<DayItineraryState>({ status: 'loading' });
  const [editState, setEditState] = useState<EditState>({ status: 'idle' });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: 'idle' });

  const load = useCallback(async () => {
    if (!tripId || !date) {
      const notFound = dayItineraryFailureState(404);
      setState({ status: 'notFound', title: notFound.title, helper: notFound.helper });
      return;
    }

    setState({ status: 'loading' });
    try {
      const response = await getTripDayItinerary(tripId, date);
      setState({ status: 'success', viewModel: buildDayItineraryViewModel(response) });
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        const failure = dayItineraryFailureState(error.status);
        if (failure.status === 'notFound') {
          setState({ status: 'notFound', title: failure.title, helper: failure.helper });
          return;
        }
        setState({ status: 'error', title: failure.title, helper: failure.helper });
        return;
      }
      const failure = dayItineraryFailureState();
      setState({ status: 'error', title: failure.title, helper: failure.helper });
    }
  }, [date, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const backToTripDetail = () => {
    if (tripId) {
      router.replace(`/trips/${tripId}`);
      return;
    }
    router.replace('/');
  };

  const beginEdit = (item: DayItineraryRowViewModel) => {
    const values = buildDayItineraryEditForm(item);
    setDeleteState({ status: 'idle' });
    setEditState({ status: 'editing', item, original: values, values, errors: {} });
  };

  const updateEditValues = (values: DayItineraryEditFormValues) => {
    setEditState((current) => {
      if (current.status !== 'editing' && current.status !== 'saving') {
        return current;
      }
      return { ...current, values, errors: {}, error: undefined };
    });
  };

  const submitEdit = async () => {
    if (!tripId || !date || (editState.status !== 'editing' && editState.status !== 'saving') || editState.status === 'saving') {
      return;
    }

    const validation = validateDayItineraryEditForm(editState.original, editState.values);
    if (!validation.ok) {
      setEditState({ ...editState, errors: validation.errors, error: undefined });
      return;
    }

    const submittingState: EditState = { ...editState, status: 'saving', errors: {}, error: undefined };
    setEditState(submittingState);
    try {
      await updateDayItineraryItem(tripId, date, editState.item.id, validation.request);
      setEditState({ status: 'idle' });
      await load();
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setEditState({ status: 'idle' });
          await load();
          return;
        }
      }
      const failure = dayItineraryMutationFailureState('update');
      setEditState({ ...submittingState, status: 'editing', error: { title: failure.title, helper: failure.helper } });
    }
  };

  const beginDelete = (item: DayItineraryRowViewModel) => {
    setEditState({ status: 'idle' });
    setDeleteState({ status: 'confirming', item });
  };

  const submitDelete = async () => {
    if (!tripId || !date || (deleteState.status !== 'confirming' && deleteState.status !== 'deleting') || deleteState.status === 'deleting') {
      return;
    }

    const deletingState: DeleteState = { ...deleteState, status: 'deleting', error: undefined };
    setDeleteState(deletingState);
    try {
      await deleteDayItineraryItem(tripId, date, deleteState.item.id);
      setDeleteState({ status: 'idle' });
      await load();
    } catch (error) {
      if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
        setState({ status: 'auth' });
        return;
      }
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setState({ status: 'auth' });
          return;
        }
        if (error.status === 403 || error.status === 404) {
          setDeleteState({ status: 'idle' });
          await load();
          return;
        }
      }
      const failure = dayItineraryMutationFailureState('delete');
      setDeleteState({ ...deletingState, status: 'confirming', error: { title: failure.title, helper: failure.helper } });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Day 일정</Text>
      </View>

      {state.status === 'loading' ? (
        <View style={styles.card}>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>일정을 불러오는 중...</Text>
        </View>
      ) : null}

      {state.status === 'success' ? (
        <>
          <DayItineraryContent
            onAddPlace={() => {
              if (tripId && date) {
                router.push(buildManualPlaceRoute(tripId, date));
              }
            }}
            onDeletePlace={beginDelete}
            onEditPlace={beginEdit}
            onSearchPlace={() => {
              if (tripId && date) {
                router.push(buildGooglePlaceSearchRoute(tripId, date));
              }
            }}
            viewModel={state.viewModel}
          />
          {editState.status === 'editing' || editState.status === 'saving' ? (
            <EditPlacePanel
              editState={editState}
              onCancel={() => setEditState({ status: 'idle' })}
              onSubmit={() => void submitEdit()}
              onUpdateValues={updateEditValues}
            />
          ) : null}
          {deleteState.status === 'confirming' || deleteState.status === 'deleting' ? (
            <DeletePlacePanel
              deleteState={deleteState}
              onCancel={() => setDeleteState({ status: 'idle' })}
              onConfirm={() => void submitDelete()}
            />
          ) : null}
        </>
      ) : null}

      {state.status === 'auth' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.button}>
            <Text style={styles.buttonText}>로그인하기</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'notFound' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <Pressable accessibilityRole="button" onPress={backToTripDetail} style={styles.button}>
            <Text style={styles.buttonText}>여행 상세로</Text>
          </Pressable>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>{state.title}</Text>
          <Text style={styles.message}>{state.helper}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.button}>
            <Text style={styles.buttonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DayItineraryContent({
  onAddPlace,
  onDeletePlace,
  onEditPlace,
  onSearchPlace,
  viewModel,
}: {
  onAddPlace: () => void;
  onDeletePlace: (item: DayItineraryRowViewModel) => void;
  onEditPlace: (item: DayItineraryRowViewModel) => void;
  onSearchPlace: () => void;
  viewModel: DayItineraryViewModel;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{viewModel.dayLabel}</Text>
        <Text style={styles.dayDate}>{viewModel.formattedDate}</Text>
      </View>

      {viewModel.status === 'empty' ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>{viewModel.title}</Text>
          <Text style={styles.message}>{viewModel.helper}</Text>
        </View>
      ) : null}

      {viewModel.status === 'success' ? (
        <View style={styles.placeList}>
          {viewModel.items.map((item) => (
            <View key={item.id} style={styles.placeRow}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderText}>{item.orderLabel}</Text>
              </View>
              <View style={styles.placeContent}>
                <View style={styles.placeTitleRow}>
                  <Text style={styles.placeName}>{item.placeName}</Text>
                  <Text style={styles.placeType}>{item.placeTypeLabel}</Text>
                </View>
                <Text style={styles.address}>{item.address}</Text>
                <View style={styles.rowActionGroup}>
                  <Pressable accessibilityRole="button" onPress={() => onEditPlace(item)} style={styles.rowActionButton}>
                    <Text style={styles.rowActionText}>수정</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => onDeletePlace(item)} style={styles.rowDangerActionButton}>
                    <Text style={styles.rowDangerActionText}>삭제</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable accessibilityRole="button" onPress={onSearchPlace} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>장소 검색</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAddPlace} style={styles.button}>
          <Text style={styles.buttonText}>장소 추가</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditPlacePanel({
  editState,
  onCancel,
  onSubmit,
  onUpdateValues,
}: {
  editState: Extract<EditState, { status: 'editing' | 'saving' }>;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: DayItineraryEditFormValues) => void;
}) {
  const isSaving = editState.status === 'saving';
  const submitView = buildDayItineraryEditSubmitState(isSaving);

  return (
    <View style={styles.card}>
      <Text style={styles.panelTitle}>장소 수정</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소명</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(name) => onUpdateValues({ ...editState.values, name })}
          placeholder="예: 우메다 공중정원"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editState.values.name}
        />
        {editState.errors.name ? <Text style={styles.fieldError}>{editState.errors.name}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>주소</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(address) => onUpdateValues({ ...editState.values, address })}
          placeholder="예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editState.values.address}
        />
        {editState.errors.address ? <Text style={styles.fieldError}>{editState.errors.address}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>장소 타입</Text>
        <View style={styles.chipList}>
          {manualPlaceTypeOptions.map((option) => {
            const selected = editState.values.placeType === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => onUpdateValues({ ...editState.values, placeType: option.value as TripPlaceType })}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {editState.errors.placeType ? <Text style={styles.fieldError}>{editState.errors.placeType}</Text> : null}
        {editState.errors.form ? <Text style={styles.fieldError}>{editState.errors.form}</Text> : null}
      </View>

      {editState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editState.error.title}</Text>
          <Text style={styles.message}>{editState.error.helper}</Text>
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <Pressable accessibilityRole="button" disabled={submitView.disabled} onPress={onSubmit} style={[styles.button, submitView.disabled ? styles.buttonDisabled : null]}>
          {isSaving ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{submitView.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isSaving} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DeletePlacePanel({
  deleteState,
  onCancel,
  onConfirm,
}: {
  deleteState: Extract<DeleteState, { status: 'confirming' | 'deleting' }>;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDeleting = deleteState.status === 'deleting';
  const confirmation = buildDayItineraryDeleteConfirmation(deleteState.item);
  const submitView = buildDayItineraryDeleteSubmitState(isDeleting);

  return (
    <View style={styles.card}>
      <Text style={styles.errorTitle}>{confirmation.title}</Text>
      <Text style={styles.message}>{confirmation.itemLabel}</Text>
      <Text style={styles.message}>{confirmation.helper}</Text>
      {deleteState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{deleteState.error.title}</Text>
          <Text style={styles.message}>{deleteState.error.helper}</Text>
        </View>
      ) : null}
      <View style={styles.actionGroup}>
        <Pressable accessibilityRole="button" disabled={submitView.disabled} onPress={onConfirm} style={[styles.dangerButton, submitView.disabled ? styles.buttonDisabled : null]}>
          {isDeleting ? <ActivityIndicator color={theme.color.onPrimary} /> : null}
          <Text style={styles.buttonText}>{submitView.label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={isDeleting} onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </Pressable>
      </View>
    </View>
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
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
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
  dayHeader: {
    alignItems: 'center',
    gap: theme.space[2],
  },
  dayLabel: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayDate: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  placeList: {
    gap: theme.space[3],
  },
  placeRow: {
    alignItems: 'flex-start',
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.space[4],
    padding: theme.space[4],
  },
  orderBadge: {
    alignItems: 'center',
    backgroundColor: theme.color.primarySoft,
    borderRadius: theme.radius.pill,
    height: theme.layout.controlHSm,
    justifyContent: 'center',
    width: theme.layout.controlHSm,
  },
  orderText: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  placeContent: {
    flex: 1,
    gap: theme.space[2],
  },
  placeTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  placeName: {
    color: theme.color.textStrong,
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
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
  },
  rowActionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[2],
  },
  rowActionButton: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowDangerActionButton: {
    borderColor: theme.color.danger,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2],
  },
  rowActionText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  rowDangerActionText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
  },
  emptyBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[5],
  },
  emptyTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
  panelTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
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
    justifyContent: 'center',
    minHeight: theme.layout.tapMin,
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
  dangerButton: {
    alignItems: 'center',
    backgroundColor: theme.color.danger,
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
  buttonText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  secondaryButtonText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
    textAlign: 'center',
  },
});
