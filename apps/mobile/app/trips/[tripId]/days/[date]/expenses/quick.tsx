import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Text,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { Card, PrimaryButton, ScreenBackground, SecondaryButton, theme } from '../../../../../../lib/design';
import {
  QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE,
  buildFocusedMemoScrollTarget,
} from '../../../../../../lib/trips/quick-expense-keyboard-layout';
import { KeyboardAwareFormScrollView } from '../../../../../../lib/trip-ui/KeyboardAwareFormScrollView';
import {
  QuickExpenseForm,
  QuickExpenseSavedSummaryCard,
  buildQuickExpenseFormSubmitState,
} from '../../../../../../lib/trip-ui/QuickExpenseEntryParts';
import { StickyActionFooter, useStickyActionFooterLayout } from '../../../../../../lib/trip-ui/StickyActionFooter';
import { styles } from '../../../../../../lib/trip-ui/QuickExpenseEntryStyles';
import { useQuickExpenseController } from '../../../../../../lib/trip-ui/useQuickExpenseController';

export default function QuickExpenseScreen() {
  const {
    acceptReceiptDraft,
    amountInput,
    backToDay,
    clearReceiptDraft,
    clearTripDay,
    completeSavedExpense,
    createReceiptPlaceCandidate,
    errors,
    expenseCategory,
    expenseDateInput,
    formMessage,
    goToLogin,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    receiptBusy,
    receiptDraft,
    receiptMessage,
    receiptPlaceBusy,
    savedSummary,
    saving,
    selectCurrency,
    selectExpenseCategory,
    selectItem,
    selectPayer,
    selectSplitPolicy,
    selectTripDay,
    selectedItemId,
    selectedSplitParticipantIds,
    selectedTripPlaceId,
    setMemoInput,
    splitPolicy,
    state,
    submit,
    titleInput,
    tripId,
    toggleIncludeInSettlement,
    toggleSplitParticipant,
    updateAmountInput,
    updateExpenseDateInput,
    updateManualSplitInput,
    updateTitleInput,
    viewModel,
  } = useQuickExpenseController();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollMetricsRef = useRef({ currentScrollY: 0, keyboardHeight: 0, viewportHeight: 0 });
  const memoLayoutRef = useRef<{ height: number; y: number } | null>(null);
  const footerLayout = useStickyActionFooterLayout({
    actionCount: 2,
    minClearance: QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE,
  });

  useEffect(() => {
    const updateKeyboardHeight = (event: KeyboardEvent) => {
      scrollMetricsRef.current.keyboardHeight = Math.max(0, event.endCoordinates.height);
    };
    const clearKeyboardHeight = () => {
      scrollMetricsRef.current.keyboardHeight = 0;
    };
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', updateKeyboardHeight),
      Keyboard.addListener('keyboardDidShow', updateKeyboardHeight),
      Keyboard.addListener('keyboardWillHide', clearKeyboardHeight),
      Keyboard.addListener('keyboardDidHide', clearKeyboardHeight),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  const handleScrollLayout = useCallback((event: LayoutChangeEvent) => {
    scrollMetricsRef.current.viewportHeight = event.nativeEvent.layout.height;
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollMetricsRef.current.currentScrollY = event.nativeEvent.contentOffset.y;
  }, []);

  const handleMemoLayout = useCallback((layout: { height: number; y: number }) => {
    memoLayoutRef.current = layout;
  }, []);

  const scrollMemoInputIntoView = useCallback(() => {
    const scroll = () => {
      const memoLayout = memoLayoutRef.current;
      if (!memoLayout) {
        return;
      }

      const target = buildFocusedMemoScrollTarget({
        currentScrollY: scrollMetricsRef.current.currentScrollY,
        fieldHeight: memoLayout.height,
        fieldY: memoLayout.y,
        keyboardHeight: scrollMetricsRef.current.keyboardHeight,
        viewportHeight: scrollMetricsRef.current.viewportHeight,
      });

      if (!target) {
        return;
      }

      scrollMetricsRef.current.currentScrollY = target.targetY;
      scrollViewRef.current?.scrollTo({ y: target.targetY, animated: true });
    };

    requestAnimationFrame(scroll);
    setTimeout(scroll, 320);
  }, []);
  const submitState = viewModel
    ? buildQuickExpenseFormSubmitState({
        amountInput,
        expenseCategory,
        expenseDateInput,
        includeInSettlement,
        manualSplitInputs,
        memoInput,
        mode: state.status === 'success' ? state.mode : 'today',
        payerParticipantId,
        saving,
        selectedItemId,
        selectedTripPlaceId,
        selectedSplitParticipantIds,
        splitPolicy,
        titleInput,
        viewModel,
      })
    : null;
  const showStickyActions = state.status === 'success' && !savedSummary && Boolean(viewModel) && Boolean(submitState);

  return (
    <ScreenBackground style={styles.screenRoot}>
      <KeyboardAwareFormScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardFixedBottomOffset={footerLayout.keyboardFixedBottomOffset}
        keyboardMinClearance={footerLayout.keyboardMinClearance}
        onLayout={handleScrollLayout}
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
        style={styles.scroll}
      >
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

        {state.status === 'success' && savedSummary ? (
          <QuickExpenseSavedSummaryCard onDone={completeSavedExpense} summary={savedSummary} />
        ) : null}

        {state.status === 'success' && !savedSummary && viewModel ? (
          <QuickExpenseForm
            amountInput={amountInput}
            errors={errors}
            expenseCategory={expenseCategory}
            expenseDateInput={expenseDateInput}
            formMessage={formMessage}
            includeInSettlement={includeInSettlement}
            mode={state.mode}
            onBack={backToDay}
            onClearReceiptDraft={() => void clearReceiptDraft()}
            onClearTripDay={clearTripDay}
            onCreateReceiptPlaceCandidate={() => void createReceiptPlaceCandidate()}
            onReceiptDraftCreated={acceptReceiptDraft}
            onSelectCurrency={selectCurrency}
            onSelectExpenseCategory={selectExpenseCategory}
            onSelectItem={selectItem}
            onSelectPayer={selectPayer}
            onSelectSplitPolicy={selectSplitPolicy}
            onSelectTripDay={selectTripDay}
            onSubmit={() => void submit()}
            onToggleIncludeInSettlement={toggleIncludeInSettlement}
            onToggleSplitParticipant={toggleSplitParticipant}
            onUpdateAmount={updateAmountInput}
            onUpdateExpenseDate={updateExpenseDateInput}
            onUpdateMemo={setMemoInput}
            onMemoFocus={scrollMemoInputIntoView}
            onMemoLayout={handleMemoLayout}
            onUpdateManualSplitInput={updateManualSplitInput}
            onUpdateTitle={updateTitleInput}
            payerParticipantId={payerParticipantId}
            receiptBusy={receiptBusy}
            receiptDraft={receiptDraft}
            receiptMessage={receiptMessage}
            receiptPlaceBusy={receiptPlaceBusy}
            saving={saving}
            selectedItemId={selectedItemId}
            selectedTripPlaceId={selectedTripPlaceId}
            selectedSplitParticipantIds={selectedSplitParticipantIds}
            splitPolicy={splitPolicy}
            manualSplitInputs={manualSplitInputs}
            memoInput={memoInput}
            titleInput={titleInput}
            tripId={tripId ?? ''}
            tripName={state.tripName}
            viewModel={viewModel}
            showActions={false}
          />
        ) : null}

        {state.status === 'auth' ? (
          <Card>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <PrimaryButton label="로그인하기" onPress={goToLogin} />
          </Card>
        ) : null}

        {state.status === 'invalid' ? (
          <Card>
            <Text style={styles.errorTitle}>잘못된 지출 등록 주소예요.</Text>
            <PrimaryButton label="일정으로 돌아가기" onPress={backToDay} />
          </Card>
        ) : null}

        {state.status === 'notFound' || state.status === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>
              {state.status === 'notFound' ? '지출을 저장할 수 없어요.' : '불러올 수 없어요.'}
            </Text>
            <Text style={styles.message}>{state.message}</Text>
            <PrimaryButton label="다시 시도" onPress={() => void load()} />
            <SecondaryButton label="일정으로 돌아가기" onPress={backToDay} />
          </Card>
        ) : null}
      </KeyboardAwareFormScrollView>
      {showStickyActions && submitState ? (
        <StickyActionFooter actionCount={2} layout={footerLayout}>
          <PrimaryButton
            disabled={submitState.disabled}
            label="저장하기"
            loading={saving}
            loadingLabel="저장 중..."
            onPress={() => void submit()}
          />
          <SecondaryButton disabled={saving} label="돌아가기" onPress={backToDay} />
        </StickyActionFooter>
      ) : null}
    </ScreenBackground>
  );
}
