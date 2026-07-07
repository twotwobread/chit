import { Pressable, Text, TextInput, View } from 'react-native';

import { type NonPlaceTransportMode } from '@i-um/api-contract';

import { Card, PrimaryButton, SecondaryButton, theme } from '../design';
import {
  buildNonPlaceScheduleItemSubmitState,
  nonPlaceCategoryOptions,
  nonPlaceTransportModeOptions,
  type NonPlaceScheduleItemFormValues,
} from '../trips/non-place-schedule-item';
import { styles } from './DayItineraryEditorStyles';
import type { NonPlaceScheduleItemPanelState } from './DayItineraryEditorTypes';
import { ScheduleTimeEditor } from './ScheduleTimeEditor';

const nonPlaceTimeHelper =
  '비워두면 순서만 있는 일정으로 저장돼요. 시간을 바꿔도 순서는 자동으로 바뀌지 않아요. 필요하면 순서 변경으로 조정해주세요.';

export function NonPlaceScheduleItemPanel({
  editorState,
  onCancel,
  onSubmit,
  onUpdateValues,
}: {
  editorState: NonPlaceScheduleItemPanelState;
  onCancel: () => void;
  onSubmit: () => void;
  onUpdateValues: (values: NonPlaceScheduleItemFormValues) => void;
}) {
  const isSaving = editorState.status === 'saving';
  const submitView = buildNonPlaceScheduleItemSubmitState(isSaving, editorState.mode);
  const update = (patch: Partial<NonPlaceScheduleItemFormValues>) =>
    onUpdateValues({ ...editorState.values, ...patch });

  return (
    <Card>
      <Text style={styles.panelTitle}>
        {editorState.mode === 'create' ? '장소 없는 일정 추가' : '장소 없는 일정 수정'}
      </Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>분류</Text>
        <View style={styles.chipList}>
          {nonPlaceCategoryOptions.map((option) => {
            const selected = editorState.values.category === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                key={option.value}
                onPress={() => update({ category: option.value })}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>제목</Text>
        <TextInput
          editable={!isSaving}
          onChangeText={(title) => update({ title })}
          placeholder="예: 체크아웃, 공항 이동"
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editorState.values.title}
        />
        {editorState.errors.title ? <Text style={styles.fieldError}>{editorState.errors.title}</Text> : null}
      </View>

      <ScheduleTimeEditor
        disabled={isSaving}
        emptyHelper="시간을 정하지 않으면 시간 미정 일정으로 저장돼요."
        endTimeError={editorState.errors.endTime}
        helper={nonPlaceTimeHelper}
        onChange={update}
        startTimeError={editorState.errors.startTime}
        values={editorState.values}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          editable={!isSaving}
          multiline
          onChangeText={(memo) => update({ memo })}
          placeholder="선택 입력"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.addressInput]}
          textAlignVertical="top"
          value={editorState.values.memo}
        />
        {editorState.errors.memo ? <Text style={styles.fieldError}>{editorState.errors.memo}</Text> : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>링크</Text>
        <TextInput
          autoCapitalize="none"
          editable={!isSaving}
          keyboardType="url"
          onChangeText={(link) => update({ link })}
          placeholder="https://..."
          placeholderTextColor={theme.color.textFaint}
          style={styles.input}
          value={editorState.values.link}
        />
        {editorState.errors.link ? <Text style={styles.fieldError}>{editorState.errors.link}</Text> : null}
      </View>

      {editorState.values.category === 'transport' ? (
        <>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>이동 수단</Text>
            <View style={styles.chipList}>
              {nonPlaceTransportModeOptions.map((option) => {
                const selected = editorState.values.transportMode === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    key={option.value}
                    onPress={() => update({ transportMode: option.value as NonPlaceTransportMode })}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                  >
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {editorState.errors.transportMode ? (
              <Text style={styles.fieldError}>{editorState.errors.transportMode}</Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>출발/도착</Text>
            <View style={styles.timeFieldRow}>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(originText) => update({ originText })}
                  placeholder="출발지"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.originText}
                />
                {editorState.errors.originText ? (
                  <Text style={styles.fieldError}>{editorState.errors.originText}</Text>
                ) : null}
              </View>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(destinationText) => update({ destinationText })}
                  placeholder="도착지"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.destinationText}
                />
                {editorState.errors.destinationText ? (
                  <Text style={styles.fieldError}>{editorState.errors.destinationText}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>예약/탑승 정보</Text>
            <TextInput
              editable={!isSaving}
              onChangeText={(referenceNumber) => update({ referenceNumber })}
              placeholder="편명/열차번호"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.referenceNumber}
            />
            {editorState.errors.referenceNumber ? (
              <Text style={styles.fieldError}>{editorState.errors.referenceNumber}</Text>
            ) : null}
            <TextInput
              editable={!isSaving}
              onChangeText={(bookingReference) => update({ bookingReference })}
              placeholder="예약번호"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              value={editorState.values.bookingReference}
            />
            {editorState.errors.bookingReference ? (
              <Text style={styles.fieldError}>{editorState.errors.bookingReference}</Text>
            ) : null}
            <View style={styles.timeFieldRow}>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(terminalText) => update({ terminalText })}
                  placeholder="터미널"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.terminalText}
                />
                {editorState.errors.terminalText ? (
                  <Text style={styles.fieldError}>{editorState.errors.terminalText}</Text>
                ) : null}
              </View>
              <View style={styles.timeField}>
                <TextInput
                  editable={!isSaving}
                  onChangeText={(gateText) => update({ gateText })}
                  placeholder="게이트"
                  placeholderTextColor={theme.color.textFaint}
                  style={styles.input}
                  value={editorState.values.gateText}
                />
                {editorState.errors.gateText ? (
                  <Text style={styles.fieldError}>{editorState.errors.gateText}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </>
      ) : null}

      {editorState.errors.form ? <Text style={styles.fieldError}>{editorState.errors.form}</Text> : null}
      {editorState.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{editorState.error.title}</Text>
          <Text style={styles.message}>{editorState.error.helper}</Text>
        </View>
      ) : null}

      <View style={styles.actionGroup}>
        <PrimaryButton
          disabled={submitView.disabled}
          label={submitView.label}
          loading={isSaving}
          loadingLabel={submitView.label}
          onPress={onSubmit}
        />
        <SecondaryButton disabled={isSaving} label="취소" onPress={onCancel} />
      </View>
    </Card>
  );
}
