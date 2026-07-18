import { ActivityIndicator, Text } from 'react-native';

import { Card, SecondaryButton, theme } from '../../../../../../../lib/design';
import { ExpenseEditForm } from '../../../../../../../lib/trip-ui/ExpenseEditScreenParts';
import { KeyboardAwareFormScrollView } from '../../../../../../../lib/trip-ui/KeyboardAwareFormScrollView';
import { styles } from '../../../../../../../lib/trip-ui/ExpenseEditScreenStyles';
import { useExpenseEditController } from '../../../../../../../lib/trip-ui/useExpenseEditController';

export default function ExpenseEditScreen() {
  const {
    amountInput,
    confirmDelete,
    deleting,
    errors,
    formMessage,
    goBack,
    includeInSettlement,
    load,
    manualSplitInputs,
    memoInput,
    saving,
    clearTripDay,
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

  return (
    <KeyboardAwareFormScrollView contentContainerStyle={styles.container}>
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
          formMessage={formMessage}
          includeInSettlement={includeInSettlement}
          memoInput={memoInput}
          onAmountChange={setAmountInput}
          onDelete={confirmDelete}
          onMemoChange={setMemoInput}
          onPayerChange={setPayerParticipantId}
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
        />
      ) : null}
    </KeyboardAwareFormScrollView>
  );
}
