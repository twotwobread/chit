import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Text,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';

import { Card, PrimaryButton, ScreenBackground, SecondaryButton, theme } from '../../../../../../../lib/design';
import {
  QUICK_EXPENSE_MEMO_KEYBOARD_MIN_CLEARANCE,
  buildFocusedMemoScrollTarget,
} from '../../../../../../../lib/trips/quick-expense-keyboard-layout';
import {
  ExpenseEditForm,
  buildExpenseEditFormSubmitState,
} from '../../../../../../../lib/trip-ui/ExpenseEditScreenParts';
import { KeyboardAwareFormScrollView } from '../../../../../../../lib/trip-ui/KeyboardAwareFormScrollView';
import { StickyActionFooter, useStickyActionFooterLayout } from '../../../../../../../lib/trip-ui/StickyActionFooter';
import { styles } from '../../../../../../../lib/trip-ui/ExpenseEditScreenStyles';
import { useExpenseEditController } from '../../../../../../../lib/trip-ui/useExpenseEditController';

export default function ExpenseEditScreen() {
  const {
    amountInput,
    confirmDelete,
    deleting,
    errors,
    expenseCategory,
    formMessage,
    goBack,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    saving,
    clearTripDay,
    selectCurrency,
    selectExpenseCategory,
    selectItem,
    selectTripDay,
    setAmountInput,
    setIncludeInSettlement,
    setMemoInput,
    setPayerParticipantId,
    setSplitPolicy,
    setTitleInput,
    splitPolicy,
    state,
    submitSave,
    titleInput,
    toggleSplitParticipant,
    updateManualSplitInput,
    viewModel,
  } = useExpenseEditController();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollMetricsRef = useRef({ currentScrollY: 0, keyboardHeight: 0, viewportHeight: 0 });
  const memoLayoutRef = useRef<{ height: number; y: number } | null>(null);
  const footerLayout = useStickyActionFooterLayout({
    actionCount: 1,
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
    ? buildExpenseEditFormSubmitState({
        amountInput,
        deleting,
        expenseCategory,
        includeInSettlement,
        manualSplitInputs,
        memoInput,
        saving,
        splitPolicy,
        titleInput,
        viewModel,
      })
    : null;
  const showStickyActions = state.status === 'success' && Boolean(viewModel) && Boolean(submitState);

  return (
    <ScreenBackground style={styles.screenRoot}>
      <KeyboardAwareFormScrollView
        contentContainerStyle={styles.container}
        keyboardFixedBottomOffset={footerLayout.keyboardFixedBottomOffset}
        keyboardMinClearance={footerLayout.keyboardMinClearance}
        onLayout={handleScrollLayout}
        onScroll={handleScroll}
        ref={scrollViewRef}
        scrollEventThrottle={16}
      >
        <Text style={styles.screenTitle}>지출 수정</Text>

        {state.status === 'loading' ? (
          <Card>
            <ActivityIndicator color={theme.color.primary} />
            <Text style={styles.message}>지출 정보를 불러오는 중...</Text>
          </Card>
        ) : null}

        {state.status === 'auth' ? (
          <Card>
            <Text style={styles.errorTitle}>다시 로그인해주세요.</Text>
            <Text style={styles.message}>로그인이 만료되었어요.</Text>
          </Card>
        ) : null}

        {state.status === 'invalid' ? (
          <Card>
            <Text style={styles.errorTitle}>잘못된 지출 수정 주소예요.</Text>
            <SecondaryButton label="돌아가기" onPress={goBack} />
          </Card>
        ) : null}

        {state.status === 'notFound' || state.status === 'error' ? (
          <Card>
            <Text style={styles.errorTitle}>
              {state.status === 'notFound' ? '지출을 찾을 수 없어요.' : '불러올 수 없어요.'}
            </Text>
            <Text style={styles.message}>{state.message}</Text>
            <SecondaryButton label="다시 시도" onPress={() => void load()} />
          </Card>
        ) : null}

        {state.status === 'success' && viewModel ? (
          <ExpenseEditForm
            amountInput={amountInput}
            deleting={deleting}
            errors={errors}
            expenseCategory={expenseCategory}
            formMessage={formMessage}
            includeInSettlement={includeInSettlement}
            memoInput={memoInput}
            onAmountChange={setAmountInput}
            onDelete={confirmDelete}
            onMemoChange={setMemoInput}
            onMemoFocus={scrollMemoInputIntoView}
            onMemoLayout={handleMemoLayout}
            onPayerChange={setPayerParticipantId}
            onCurrencyChange={selectCurrency}
            onExpenseCategoryChange={selectExpenseCategory}
            onSettlementIncludeChange={setIncludeInSettlement}
            onClearTripDay={clearTripDay}
            onPlaceChange={selectItem}
            onSave={() => void submitSave()}
            onSelectTripDay={selectTripDay}
            onSplitPolicyChange={setSplitPolicy}
            onTitleChange={setTitleInput}
            onToggleSplitParticipant={toggleSplitParticipant}
            onUpdateManualSplitInput={updateManualSplitInput}
            saving={saving}
            splitPolicy={splitPolicy}
            titleInput={titleInput}
            manualSplitInputs={manualSplitInputs}
            viewModel={viewModel}
            showSaveAction={false}
          />
        ) : null}
      </KeyboardAwareFormScrollView>
      {showStickyActions && submitState && viewModel ? (
        <StickyActionFooter actionCount={1} layout={footerLayout}>
          <PrimaryButton
            disabled={submitState.disabled}
            label={viewModel.saveLabel}
            loading={saving}
            loadingLabel="저장 중..."
            onPress={() => void submitSave()}
          />
        </StickyActionFooter>
      ) : null}
    </ScreenBackground>
  );
}
