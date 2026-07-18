import { ActivityIndicator, Text, View } from 'react-native';

import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../lib/design';
import { KeyboardAwareFormScrollView } from '../../../../../../lib/trip-ui/KeyboardAwareFormScrollView';
import { QuickExpenseForm, QuickExpenseSavedSummaryCard } from '../../../../../../lib/trip-ui/QuickExpenseEntryParts';
import { styles } from '../../../../../../lib/trip-ui/QuickExpenseEntryStyles';
import { useQuickExpenseController } from '../../../../../../lib/trip-ui/useQuickExpenseController';

export default function QuickExpenseScreen() {
  const {
    amountInput,
    backToDay,
    clearTripDay,
    errors,
    expenseDateInput,
    formMessage,
    goToLogin,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    savedSummary,
    saving,
    selectItem,
    selectPayer,
    selectSplitPolicy,
    selectTripDay,
    selectedItemId,
    selectedSplitParticipantIds,
    setMemoInput,
    splitPolicy,
    state,
    submit,
    titleInput,
    toggleIncludeInSettlement,
    toggleSplitParticipant,
    updateAmountInput,
    updateExpenseDateInput,
    updateManualSplitInput,
    updateTitleInput,
    viewModel,
  } = useQuickExpenseController();

  return (
    <KeyboardAwareFormScrollView contentContainerStyle={styles.scrollContent} style={styles.scroll}>
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
        <QuickExpenseSavedSummaryCard onDone={backToDay} summary={savedSummary} />
      ) : null}

      {state.status === 'success' && !savedSummary && viewModel ? (
        <QuickExpenseForm
          amountInput={amountInput}
          errors={errors}
          expenseDateInput={expenseDateInput}
          formMessage={formMessage}
          includeInSettlement={includeInSettlement}
          mode={state.mode}
          onBack={backToDay}
          onClearTripDay={clearTripDay}
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
          onUpdateManualSplitInput={updateManualSplitInput}
          onUpdateTitle={updateTitleInput}
          payerParticipantId={payerParticipantId}
          saving={saving}
          selectedItemId={selectedItemId}
          selectedSplitParticipantIds={selectedSplitParticipantIds}
          splitPolicy={splitPolicy}
          manualSplitInputs={manualSplitInputs}
          memoInput={memoInput}
          titleInput={titleInput}
          tripName={state.tripName}
          viewModel={viewModel}
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
  );
}
