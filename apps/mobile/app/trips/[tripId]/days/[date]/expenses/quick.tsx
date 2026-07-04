import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Card, PrimaryButton, SecondaryButton, theme } from '../../../../../../lib/design';
import { QuickExpenseForm, QuickExpenseSavedSummaryCard } from '../../../../../../lib/trip-ui/QuickExpenseEntryParts';
import { styles } from '../../../../../../lib/trip-ui/QuickExpenseEntryStyles';
import { useQuickExpenseController } from '../../../../../../lib/trip-ui/useQuickExpenseController';

export default function QuickExpenseScreen() {
  const {
    amountInput,
    backToDay,
    errors,
    formMessage,
    goToLogin,
    load,
    manualSplitInputs,
    memoInput,
    payerParticipantId,
    savedSummary,
    saving,
    selectItem,
    selectPayer,
    selectSplitPolicy,
    selectedItemId,
    selectedSplitParticipantIds,
    setMemoInput,
    splitPolicy,
    state,
    submit,
    toggleSplitParticipant,
    updateAmountInput,
    updateManualSplitInput,
    viewModel,
  } = useQuickExpenseController();

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

      {state.status === 'success' && savedSummary ? (
        <QuickExpenseSavedSummaryCard onDone={backToDay} summary={savedSummary} />
      ) : null}

      {state.status === 'success' && !savedSummary && viewModel ? (
        <QuickExpenseForm
          amountInput={amountInput}
          errors={errors}
          formMessage={formMessage}
          onBack={backToDay}
          onSelectItem={selectItem}
          onSelectPayer={selectPayer}
          onSelectSplitPolicy={selectSplitPolicy}
          onSubmit={() => void submit()}
          onToggleSplitParticipant={toggleSplitParticipant}
          onUpdateAmount={updateAmountInput}
          onUpdateMemo={setMemoInput}
          onUpdateManualSplitInput={updateManualSplitInput}
          payerParticipantId={payerParticipantId}
          saving={saving}
          selectedItemId={selectedItemId}
          selectedSplitParticipantIds={selectedSplitParticipantIds}
          splitPolicy={splitPolicy}
          manualSplitInputs={manualSplitInputs}
          memoInput={memoInput}
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
    </ScrollView>
  );
}
