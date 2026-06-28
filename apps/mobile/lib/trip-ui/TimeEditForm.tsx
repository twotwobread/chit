import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PlacePin, SegmentedControl, theme } from '../design';
import type { ItineraryTimelineItem } from './itinerary-segments';

export type TimeEditMode = 'timed' | 'untimed';

export type TimeEditDraft = {
  mode: TimeEditMode;
  startTime: string;
  endTime: string;
};

export type TimeEditPayload = {
  mode: TimeEditMode;
  startTime: string | null;
  endTime: string | null;
};

export type TimeEditFormProps = {
  item: ItineraryTimelineItem;
  initialDraft?: Partial<TimeEditDraft>;
  onChange?: (draft: TimeEditDraft) => void;
  onSave: (payload: TimeEditPayload) => void;
  onCancel?: () => void;
  errorMessage?: string | null;
};

const MODE_LABELS = ['시간 지정', '시간 미정'];

export function TimeEditForm({ errorMessage, initialDraft, item, onCancel, onChange, onSave }: TimeEditFormProps) {
  const [draft, setDraft] = useState<TimeEditDraft>({
    endTime: initialDraft?.endTime ?? item.endTime ?? '',
    mode: initialDraft?.mode ?? (item.startTime ? 'timed' : 'untimed'),
    startTime: initialDraft?.startTime ?? item.startTime ?? '',
  });
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    onChange?.(draft);
  }, [draft, onChange]);

  const updateDraft = (patch: Partial<TimeEditDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const save = () => {
    if (draft.mode === 'untimed') {
      setLocalError(null);
      onSave({ endTime: null, mode: 'untimed', startTime: null });
      return;
    }

    if (!isTimeValue(draft.startTime)) {
      setLocalError('시작 시간을 HH:MM 형식으로 입력해주세요.');
      return;
    }
    if (draft.endTime && !isTimeValue(draft.endTime)) {
      setLocalError('종료 시간을 HH:MM 형식으로 입력해주세요.');
      return;
    }

    setLocalError(null);
    onSave({ endTime: draft.endTime || null, mode: 'timed', startTime: draft.startTime });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <PlacePin order={item.order} size={34} type={item.type} />
        <View style={styles.headBody}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>{[theme.placeType[item.type].label, item.area].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>

      <SegmentedControl
        onChange={(value) => updateDraft({ mode: value === MODE_LABELS[0] ? 'timed' : 'untimed' })}
        options={MODE_LABELS}
        value={draft.mode === 'timed' ? MODE_LABELS[0] : MODE_LABELS[1]}
      />

      {draft.mode === 'timed' ? (
        <View style={styles.timedBlock}>
          <TimeField label="시작" onChange={(startTime) => updateDraft({ startTime })} value={draft.startTime} />
          <TimeField label="종료" onChange={(endTime) => updateDraft({ endTime })} optional value={draft.endTime} />
          <Text style={styles.helper}>종료 시간을 비우면 시작 시간만 있는 앵커로 표시돼요.</Text>
        </View>
      ) : (
        <View style={styles.untimedBlock}>
          <Text style={styles.untimedText}>시간 미정으로 두면 앞뒤 시간 항목 사이에서 순서대로 보여요.</Text>
        </View>
      )}

      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.actionRow}>
        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancel, pressed ? styles.pressed : null]}
          >
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => [styles.save, pressed ? styles.pressed : null]}
        >
          <Text style={styles.saveText}>저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimeField({
  label,
  onChange,
  optional = false,
  value,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TextInput
        keyboardType="numbers-and-punctuation"
        onChangeText={onChange}
        placeholder={optional ? '선택 안 함' : '10:00'}
        placeholderTextColor={theme.color.textFaint}
        style={styles.timeInput}
        value={value}
      />
    </View>
  );
}

function isTimeValue(value: string): boolean {
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginTop: theme.space[6],
  },
  cancel: {
    alignItems: 'center',
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.lg,
    flex: 1,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.caption,
    fontWeight: theme.font.weight.semibold,
    marginTop: theme.space[3],
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.space[3],
    marginBottom: theme.space[5],
  },
  headBody: {
    flex: 1,
  },
  helper: {
    color: theme.color.textFaint,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.normal,
    marginTop: theme.space[1],
  },
  name: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  pressed: {
    opacity: 0.72,
  },
  save: {
    alignItems: 'center',
    backgroundColor: theme.color.primary,
    borderRadius: theme.radius.lg,
    flex: 2,
    height: theme.layout.controlHLg,
    justifyContent: 'center',
  },
  saveText: {
    color: theme.color.onPrimary,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
  },
  sub: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    marginTop: theme.space[1],
  },
  timeField: {
    alignItems: 'center',
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: theme.layout.controlHLg,
    justifyContent: 'space-between',
    marginBottom: theme.space[3],
    paddingHorizontal: theme.space[5],
  },
  timeInput: {
    color: theme.color.textStrong,
    flex: 1,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.font.weight.bold,
    textAlign: 'right',
  },
  timeLabel: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.semibold,
    fontSize: theme.font.size.body,
    fontWeight: theme.font.weight.semibold,
  },
  timedBlock: {
    marginTop: theme.space[5],
  },
  untimedBlock: {
    backgroundColor: theme.color.surfaceSunken,
    borderRadius: theme.radius.md,
    marginTop: theme.space[4],
    padding: theme.space[4],
  },
  untimedText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    fontSize: theme.font.size.caption,
    lineHeight: theme.font.size.caption * theme.font.leading.relaxed,
  },
  wrap: {
    paddingBottom: theme.space[3],
  },
});
