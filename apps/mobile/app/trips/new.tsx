import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import type { CreateTripResponse, SupportedCurrency } from '@i-um/api-contract';

import { MobileAuthError } from '../../lib/auth/client';
import { Card, PrimaryButton, SecondaryButton, theme } from '../../lib/design';
import { createTrip } from '../../lib/trips/client';
import { dateFromString, isValidDate, monthStringFromDate, todayString } from '../../lib/trips/date';
import { TripDateFieldButton, TripDatePicker, TripFormField } from '../../lib/trips/date-picker';

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  defaultCurrency: SupportedCurrency;
};

type DateField = 'startDate' | 'endDate';
const currencies: SupportedCurrency[] = ['KRW', 'JPY', 'USD', 'EUR'];
const yearOptionCount = 10;

const initialForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  defaultCurrency: 'KRW',
};

export default function NewTripScreen() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateTripResponse | null>(null);
  const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStringFromDate(new Date()));
  const today = todayString();

  const openDatePicker = (field: DateField) => {
    const value = field === 'startDate' ? form.startDate : form.endDate;
    const minDate = minDateForField(field, form.startDate, today);
    setCalendarMonth(monthStringFromDate(dateFromString(value || minDate)));
    setActiveDateField(field);
    setError(null);
  };

  const selectDate = (date: string) => {
    if (!activeDateField) {
      return;
    }

    setForm((current) => {
      if (activeDateField === 'startDate') {
        return {
          ...current,
          startDate: date,
          endDate: current.endDate && current.endDate < date ? '' : current.endDate,
        };
      }
      return { ...current, endDate: date };
    });
    setActiveDateField(null);
  };

  const submit = async () => {
    const validationError = validateForm(form, today);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await createTrip({
        name: form.name,
        startDate: form.startDate,
        endDate: form.endDate,
        defaultCurrency: form.defaultCurrency,
      });
      setCreated(response);
    } catch (submitError) {
      if (
        submitError instanceof MobileAuthError &&
        (submitError.code === 'INVALID_REFRESH_TOKEN' || submitError.code === 'UNAUTHORIZED')
      ) {
        setError('다시 로그인해주세요.');
      } else {
        setError('여행을 만들 수 없어요. 입력 내용을 확인하고 다시 시도해주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setError(null);
    setCreated(null);
    setActiveDateField(null);
  };

  if (created) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.successTitle}>여행이 만들어졌어요.</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>{created.trip.name}</Text>
            <Text style={styles.summaryText}>
              {created.trip.startDate} ~ {created.trip.endDate}
            </Text>
            <Text style={styles.summaryText}>기본 통화: {created.trip.defaultCurrency}</Text>
          </View>
          <PrimaryButton label="여행 상세 보기" onPress={() => router.push(`/trips/${created.trip.id}`)} />
          <SecondaryButton label="마이페이지에서 보기" onPress={() => router.push('/mypage')} />
          <SecondaryButton label="새 여행 만들기" onPress={reset} />
          <SecondaryButton label="홈으로" onPress={() => router.replace('/')} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>새 여행 만들기</Text>
        <Text style={styles.subtitle}>이름과 기간만 정하면 바로 시작할 수 있어요.</Text>
      </View>

      <Card>
        <TripFormField label="여행 이름">
          <TextInput
            editable={!submitting}
            onChangeText={(name) => setForm((current) => ({ ...current, name }))}
            placeholder="예: 오사카 3박 4일"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            value={form.name}
          />
        </TripFormField>

        <TripFormField label="시작일">
          <TripDateFieldButton
            disabled={submitting}
            onPress={() => openDatePicker('startDate')}
            value={form.startDate}
          />
        </TripFormField>

        <TripFormField label="종료일">
          <TripDateFieldButton
            disabled={submitting}
            onPress={() => openDatePicker('endDate')}
            value={form.endDate}
          />
        </TripFormField>

        {activeDateField ? (
          <TripDatePicker
            helperText="오늘 이전 날짜는 선택할 수 없어요."
            label={activeDateField === 'startDate' ? '시작일 선택' : '종료일 선택'}
            minDate={minDateForField(activeDateField, form.startDate, today)}
            month={calendarMonth}
            onClose={() => setActiveDateField(null)}
            onMonthChange={setCalendarMonth}
            onSelect={selectDate}
            selectedDate={activeDateField === 'startDate' ? form.startDate : form.endDate}
            yearOptionCount={yearOptionCount}
          />
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>기본 통화</Text>
          <View style={styles.currencyRow}>
            {currencies.map((currency) => {
              const selected = form.defaultCurrency === currency;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={submitting}
                  key={currency}
                  onPress={() => setForm((current) => ({ ...current, defaultCurrency: currency }))}
                  style={[styles.currencyChip, selected ? styles.currencyChipSelected : null]}
                >
                  <Text style={[styles.currencyText, selected ? styles.currencyTextSelected : null]}>{currency}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton
          disabled={submitting}
          label="여행 만들기"
          loading={submitting}
          loadingLabel="여행 만드는 중..."
          onPress={() => void submit()}
        />
      </Card>
    </ScrollView>
  );
}

function validateForm(form: FormState, today: string): string | null {
  const name = form.name.trim();
  if (name.length < 1) {
    return '여행 이름을 입력해주세요.';
  }
  if ([...name].length > 80) {
    return '여행 이름은 80자 이내로 입력해주세요.';
  }
  if (!form.startDate || !form.endDate) {
    return '날짜를 선택해주세요.';
  }
  if (!isValidDate(form.startDate) || !isValidDate(form.endDate)) {
    return '날짜는 YYYY-MM-DD 형식으로 입력해주세요.';
  }
  if (form.startDate > form.endDate) {
    return '종료일은 시작일보다 빠를 수 없어요.';
  }
  if (form.startDate < today || form.endDate < today) {
    return '오늘 또는 이후 날짜를 선택해주세요.';
  }
  if (!currencies.includes(form.defaultCurrency)) {
    return '지원하는 통화를 선택해주세요.';
  }
  return null;
}

function minDateForField(field: DateField, startDate: string, today: string): string {
  if (field === 'endDate' && isValidDate(startDate) && startDate > today) {
    return startDate;
  }
  return today;
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
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
    padding: theme.space[7],
  },
  header: {
    width: '100%',
    maxWidth: theme.layout.cardMaxW,
    marginBottom: theme.space[7],
  },
  title: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.titleLg,
    fontWeight: theme.font.weight.bold,
    marginBottom: theme.space[3],
    textAlign: 'center',
  },
  subtitle: {
    color: theme.color.textMuted,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  field: {
    gap: theme.space[3],
  },
  label: {
    color: theme.color.textBody,
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
    minHeight: theme.layout.controlH,
    paddingHorizontal: theme.space[5],
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space[3],
  },
  currencyChip: {
    borderColor: theme.color.borderDefault,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    minHeight: theme.layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
  },
  currencyChipSelected: {
    backgroundColor: theme.color.primarySoft,
    borderColor: theme.color.primary,
  },
  currencyText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.bold,
    fontWeight: theme.font.weight.bold,
  },
  currencyTextSelected: {
    color: theme.color.primary,
  },
  errorText: {
    color: theme.color.danger,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
  successTitle: {
    color: theme.color.success,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.headline,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summaryBox: {
    backgroundColor: theme.color.surfaceSunken,
    borderColor: theme.color.borderSubtle,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.space[3],
    padding: theme.space[5],
  },
  summaryTitle: {
    color: theme.color.textStrong,
    fontFamily: theme.font.family.bold,
    fontSize: theme.font.size.subhead,
    fontWeight: theme.font.weight.bold,
    textAlign: 'center',
  },
  summaryText: {
    color: theme.color.textBody,
    fontFamily: theme.font.family.regular,
    textAlign: 'center',
  },
});
