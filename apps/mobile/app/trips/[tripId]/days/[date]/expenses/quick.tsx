import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  ApiError,
  type GetDayItineraryResponse,
  type SupportedCurrency,
  type TripParticipantListItem,
} from '@i-um/api-contract';

import { MobileAuthError } from '../../../../../../lib/auth/client';
import { clearStoredSession } from '../../../../../../lib/auth/session';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../lib/design';
import {
  createQuickExpense,
  getTripDayItinerary,
  getTripDetail,
  listTripParticipants,
} from '../../../../../../lib/trips/client';
import {
  buildCreateQuickExpenseRequest,
  buildQuickExpenseViewModel,
  formatMoney,
  quickExpenseFailureMessage,
  type QuickExpenseFormErrors,
  type QuickExpenseViewModel,
} from '../../../../../../lib/trips/quick-expense';

type QuickExpenseState =
  | { status: 'loading' }
  | {
      status: 'success';
      tripName: string;
      currency: SupportedCurrency;
      itinerary: GetDayItineraryResponse;
      participants: TripParticipantListItem[];
      shouldChooseItem: boolean;
    }
  | { status: 'auth' }
  | { status: 'invalid' }
  | { status: 'notFound'; message: string }
  | { status: 'error'; message: string };

export default function QuickExpenseScreen() {
  const {
    tripId: tripIdParam,
    date: dateParam,
    itemId: itemIdParam,
  } = useLocalSearchParams<{ tripId?: string | string[]; date?: string | string[]; itemId?: string | string[] }>();
  const tripId = Array.isArray(tripIdParam) ? tripIdParam[0] : tripIdParam;
  const date = Array.isArray(dateParam) ? dateParam[0] : dateParam;
  const routeItemId = Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;

  const [state, setState] = useState<QuickExpenseState>({ status: 'loading' });
  const [amountInput, setAmountInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [payerParticipantId, setPayerParticipantId] = useState<string | null>(null);
  const [errors, setErrors] = useState<QuickExpenseFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const handleAuthError = useCallback(async (error: unknown) => {
    if (error instanceof MobileAuthError && (error.code === 'UNAUTHORIZED' || error.code === 'INVALID_REFRESH_TOKEN')) {
      await clearStoredSession();
      setState({ status: 'auth' });
      return true;
    }
    if (error instanceof ApiError && error.status === 401) {
      await clearStoredSession();
      setState({ status: 'auth' });
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async () => {
    if (!tripId || !date) {
      setState({ status: 'invalid' });
      return;
    }

    setState({ status: 'loading' });
    setSaving(false);
    setErrors({});
    setFormMessage(null);
    try {
      const [tripDetail, itinerary, participantsResponse] = await Promise.all([
        getTripDetail(tripId),
        getTripDayItinerary(tripId, date),
        listTripParticipants(tripId),
      ]);
      const validRouteItem =
        routeItemId && itinerary.items.some((item) => item.id === routeItemId) ? routeItemId : null;
      setSelectedItemId(validRouteItem);
      setPayerParticipantId(
        participantsResponse.participants.length === 1 ? participantsResponse.participants[0].participantId : null,
      );
      setAmountInput('');
      setState({
        status: 'success',
        tripName: tripDetail.trip.name,
        currency: tripDetail.trip.defaultCurrency,
        itinerary,
        participants: participantsResponse.participants,
        shouldChooseItem: validRouteItem === null,
      });
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setState({ status: 'notFound', message: quickExpenseFailureMessage(error.status) });
        return;
      }
      setState({
        status: 'error',
        message: quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined),
      });
    }
  }, [date, handleAuthError, routeItemId, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updateAmountInput = (value: string) => {
    setAmountInput(value);
    setErrors((current) => ({ ...current, amount: undefined }));
    setFormMessage(null);
  };

  const selectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setErrors((current) => ({ ...current, item: undefined }));
    setFormMessage(null);
  };

  const selectPayer = (participantId: string) => {
    setPayerParticipantId(participantId);
    setErrors((current) => ({ ...current, payer: undefined }));
    setFormMessage(null);
  };

  const submit = async () => {
    if (state.status !== 'success' || !tripId || !date || saving) {
      return;
    }

    const validation = buildCreateQuickExpenseRequest({
      amountInput,
      currency: state.currency,
      itineraryItemId: selectedItemId,
      payerParticipantId,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setFormMessage(null);
    setErrors({});
    try {
      const response = await createQuickExpense(tripId, date, validation.request);
      Alert.alert('지출을 저장했어요.', formatMoney(response.expense.amountMinor, response.expense.currency), [
        { text: '확인', onPress: () => router.replace('/') },
      ]);
    } catch (error) {
      if (await handleAuthError(error)) {
        return;
      }
      if (error instanceof ApiError && error.status === 409) {
        setFormMessage(quickExpenseFailureMessage(error.status));
        await load();
        return;
      }
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setFormMessage(quickExpenseFailureMessage(error.status));
        return;
      }
      setFormMessage(quickExpenseFailureMessage(error instanceof ApiError ? error.status : undefined));
    } finally {
      setSaving(false);
    }
  };

  const backToToday = () => router.replace('/');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>지출 등록</Text>
        <Text style={styles.subtitle}>금액과 결제자만 입력하면 함께 나눠요.</Text>
      </View>

      {state.status === 'loading' ? (
        <Card>
          <ActivityIndicator color={theme.color.primary} />
          <Text style={styles.message}>지출 등록 정보를 불러오는 중...</Text>
        </Card>
      ) : null}

      {state.status === 'success' ? (
        <QuickExpenseForm
          amountInput={amountInput}
          errors={errors}
          formMessage={formMessage}
          onBack={backToToday}
          onSelectItem={selectItem}
          onSelectPayer={selectPayer}
          onSubmit={() => void submit()}
          onUpdateAmount={updateAmountInput}
          payerParticipantId={payerParticipantId}
          saving={saving}
          selectedItemId={selectedItemId}
          tripName={state.tripName}
          viewModel={buildQuickExpenseViewModel({
            currency: state.currency,
            itinerary: state.itinerary,
            participants: state.participants,
            selectedItemId,
            shouldChooseItem: state.shouldChooseItem,
          })}
        />
      ) : null}

      {state.status === 'auth' ? (
        <Card>
          <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
          <PrimaryButton label="로그인하기" onPress={() => router.replace('/login')} />
        </Card>
      ) : null}

      {state.status === 'invalid' ? (
        <Card>
          <Text style={styles.errorTitle}>잘못된 지출 등록 주소예요.</Text>
          <PrimaryButton label="오늘로 돌아가기" onPress={backToToday} />
        </Card>
      ) : null}

      {state.status === 'notFound' || state.status === 'error' ? (
        <Card>
          <Text style={styles.errorTitle}>
            {state.status === 'notFound' ? '지출을 저장할 수 없어요.' : '불러올 수 없어요.'}
          </Text>
          <Text style={styles.message}>{state.message}</Text>
          <PrimaryButton label="다시 시도" onPress={() => void load()} />
          <SecondaryButton label="오늘로 돌아가기" onPress={backToToday} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

function QuickExpenseForm({
  amountInput,
  errors,
  formMessage,
  onBack,
  onSelectItem,
  onSelectPayer,
  onSubmit,
  onUpdateAmount,
  payerParticipantId,
  saving,
  selectedItemId,
  tripName,
  viewModel,
}: {
  amountInput: string;
  errors: QuickExpenseFormErrors;
  formMessage: string | null;
  onBack: () => void;
  onSelectItem: (itemId: string) => void;
  onSelectPayer: (participantId: string) => void;
  onSubmit: () => void;
  onUpdateAmount: (value: string) => void;
  payerParticipantId: string | null;
  saving: boolean;
  selectedItemId: string | null;
  tripName: string;
  viewModel: QuickExpenseViewModel;
}) {
  const validation = buildCreateQuickExpenseRequest({
    amountInput,
    currency: viewModel.currency,
    itineraryItemId: selectedItemId,
    payerParticipantId,
  });
  const canSubmit = validation.ok && !saving && !viewModel.emptyMessage;
  const selectedPayerOptions = viewModel.payerOptions.map((option) => ({
    ...option,
    selected: option.participantId === payerParticipantId,
  }));

  return (
    <Card>
      <View style={styles.sectionHeader}>
        <Text style={styles.tripName}>{tripName}</Text>
        <Text style={styles.dayText}>
          {viewModel.dayLabel} · {viewModel.formattedDate}
        </Text>
      </View>

      {viewModel.emptyMessage ? (
        <View style={styles.noticeBox}>
          <Text style={styles.message}>{viewModel.emptyMessage}</Text>
        </View>
      ) : null}

      {viewModel.helper ? <Text style={styles.helper}>{viewModel.helper}</Text> : null}

      {viewModel.showItemSelector && viewModel.itemOptions.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>장소 선택</Text>
          <View style={styles.optionList}>
            {viewModel.itemOptions.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: option.itemId === selectedItemId }}
                key={option.itemId}
                onPress={() => onSelectItem(option.itemId)}
                style={[styles.optionCard, option.itemId === selectedItemId ? styles.optionCardSelected : null]}
              >
                <View style={styles.placeMetaRow}>
                  <Text style={styles.orderBadge}>{option.orderLabel}</Text>
                  <Text style={styles.placeType}>{option.placeTypeLabel}</Text>
                </View>
                <Text style={styles.optionTitle}>{option.placeName}</Text>
                <Text style={styles.address}>{option.address}</Text>
              </Pressable>
            ))}
          </View>
          {errors.item ? <Text style={styles.errorMessage}>{errors.item}</Text> : null}
        </View>
      ) : null}

      {viewModel.selectedItem ? (
        <View style={styles.selectedPlaceBox}>
          <Text style={styles.label}>선택된 장소</Text>
          <Text style={styles.optionTitle}>{viewModel.selectedItem.placeName}</Text>
          <Text style={styles.address}>{viewModel.selectedItem.address}</Text>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>금액</Text>
        <View style={styles.amountRow}>
          <TextInput
            accessibilityLabel="금액"
            editable={!saving && !viewModel.emptyMessage}
            keyboardType={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? 'number-pad' : 'decimal-pad'}
            onChangeText={onUpdateAmount}
            placeholder={viewModel.currency === 'KRW' || viewModel.currency === 'JPY' ? '18500' : '12.34'}
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={amountInput}
          />
          <Text style={styles.currencyLabel}>{viewModel.currencyLabel}</Text>
        </View>
        {errors.amount ? <Text style={styles.errorMessage}>{errors.amount}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>결제자</Text>
        <View style={styles.optionList}>
          {selectedPayerOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: option.selected }}
              disabled={saving || Boolean(viewModel.emptyMessage)}
              key={option.participantId}
              onPress={() => onSelectPayer(option.participantId)}
              style={[styles.payerChip, option.selected ? styles.optionCardSelected : null]}
            >
              <Text style={option.selected ? styles.payerChipTextSelected : styles.payerChipText}>
                {option.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
        {errors.payer ? <Text style={styles.errorMessage}>{errors.payer}</Text> : null}
      </View>

      {formMessage ? <Text style={styles.errorMessage}>{formMessage}</Text> : null}

      <PrimaryButton
        disabled={!canSubmit}
        label="저장하기"
        loading={saving}
        loadingLabel="저장 중..."
        onPress={onSubmit}
      />
      <SecondaryButton disabled={saving} label="오늘로 돌아가기" onPress={onBack} />
    </Card>
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
    gap: theme.space[5],
    justifyContent: 'center',
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    gap: theme.space[2],
  },
  screenTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  sectionHeader: {
    gap: theme.space[2],
  },
  tripName: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.title,
    fontWeight: theme.font.weight.bold,
  },
  dayText: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  message: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  helper: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
  },
  errorTitle: {
    color: theme.color.danger,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  errorMessage: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  noticeBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  fieldGroup: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.bold,
  },
  optionList: {
    gap: theme.space[3],
  },
  optionCard: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  optionCardSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  selectedPlaceBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[2],
    padding: theme.space[4],
  },
  placeMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  orderBadge: {
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.pill,
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.bold,
    overflow: 'hidden',
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
  },
  placeType: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.label,
    fontWeight: theme.font.weight.semibold,
  },
  optionTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  address: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.body,
  },
  amountRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
  },
  input: {
    flex: 1,
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.color.textStrong,
    fontFamily: theme.font.family.regular,
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[4],
  },
  currencyLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  payerChip: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
  },
  payerChipText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontWeight: theme.font.weight.semibold,
  },
  payerChipTextSelected: {
    color: theme.color.primary,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
});
