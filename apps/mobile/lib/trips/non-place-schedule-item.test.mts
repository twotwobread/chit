import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DayItineraryRowViewModel } from './day-itinerary';
import {
  buildNonPlaceScheduleItemEditForm,
  buildNonPlaceScheduleItemSubmitState,
  emptyNonPlaceScheduleItemForm,
  hasNonPlaceScheduleItemFormChanges,
  validateCreateNonPlaceScheduleItemForm,
  validateUpdateNonPlaceScheduleItemForm,
} from './non-place-schedule-item';

describe('non-place schedule item helpers', () => {
  it('builds a trimmed transport create request with optional details', () => {
    assert.deepEqual(
      validateCreateNonPlaceScheduleItemForm({
        ...emptyNonPlaceScheduleItemForm(),
        category: 'transport',
        title: ' 공항 이동 ',
        startTime: '08:00',
        endTime: '09:30',
        memo: ' 리무진 버스 ',
        link: ' https://example.com/ticket ',
        transportMode: 'bus',
        referenceNumber: ' BUS-12 ',
        bookingReference: ' ABC123 ',
        originText: ' 난바 ',
        destinationText: ' 간사이공항 ',
        terminalText: ' T1 ',
        gateText: ' 4 ',
      }),
      {
        ok: true,
        request: {
          category: 'transport',
          title: '공항 이동',
          startTime: '08:00',
          endTime: '09:30',
          memo: '리무진 버스',
          link: 'https://example.com/ticket',
          transportMode: 'bus',
          referenceNumber: 'BUS-12',
          bookingReference: 'ABC123',
          originText: '난바',
          destinationText: '간사이공항',
          terminalText: 'T1',
          gateText: '4',
        },
      },
    );
  });

  it('validates required title, time range, link, and transport mode', () => {
    assert.deepEqual(
      validateCreateNonPlaceScheduleItemForm({
        ...emptyNonPlaceScheduleItemForm(),
        category: 'transport',
        title: ' ',
        startTime: '9:00',
        endTime: '08:00',
        link: 'ftp://example.com',
        transportMode: '',
      }),
      {
        ok: false,
        errors: {
          title: '일정 제목을 입력해주세요.',
          startTime: '시작 시간은 HH:mm 형식으로 입력해주세요.',
          link: 'http 또는 https 링크를 입력해주세요.',
          transportMode: '이동 수단을 선택해주세요.',
        },
      },
    );
  });

  it('builds non-place edit form values and changed-field update requests', () => {
    const item: DayItineraryRowViewModel = {
      id: 'item-1',
      version: 2,
      orderLabel: '1',
      itemType: 'non_place',
      isLodging: false,
      startTime: '10:00',
      endTime: null,
      timeLabel: '10:00',
      placeName: '체크아웃',
      placeType: 'etc',
      placeTypeLabel: '알림',
      address: '',
      nonPlaceCategory: 'reminder',
      nonPlaceMemo: '프런트에 키 반납',
    };
    const original = buildNonPlaceScheduleItemEditForm(item);

    assert.deepEqual(original, {
      category: 'reminder',
      title: '체크아웃',
      startTime: '10:00',
      endTime: '',
      memo: '프런트에 키 반납',
      link: '',
      transportMode: 'other',
      referenceNumber: '',
      bookingReference: '',
      originText: '',
      destinationText: '',
      terminalText: '',
      gateText: '',
    });
    assert.deepEqual(
      validateUpdateNonPlaceScheduleItemForm(original, { ...original, title: '체크아웃 준비', memo: '' }),
      {
        ok: true,
        request: {
          title: '체크아웃 준비',
          memo: '',
        },
      },
    );
  });

  it('clears transport-only fields when changing a transport item to memo', () => {
    const original = {
      ...emptyNonPlaceScheduleItemForm(),
      category: 'transport' as const,
      title: '공항 이동',
      transportMode: 'bus' as const,
      referenceNumber: 'BUS-12',
      originText: '난바',
      destinationText: '간사이공항',
    };

    assert.deepEqual(
      validateUpdateNonPlaceScheduleItemForm(original, { ...original, category: 'memo', memo: '버스 정보는 취소됨' }),
      {
        ok: true,
        request: {
          category: 'memo',
          memo: '버스 정보는 취소됨',
          transportMode: '',
          referenceNumber: '',
          originText: '',
          destinationText: '',
        },
      },
    );
  });

  it('detects normalized edit changes for close confirmation', () => {
    const original = emptyNonPlaceScheduleItemForm();

    assert.equal(hasNonPlaceScheduleItemFormChanges(original, { ...original, title: '  ' }), false);
    assert.equal(hasNonPlaceScheduleItemFormChanges(original, { ...original, title: '체크아웃' }), true);
  });

  it('maps submit labels for create and edit modes', () => {
    assert.deepEqual(buildNonPlaceScheduleItemSubmitState(false, 'create'), { disabled: false, label: '추가' });
    assert.deepEqual(buildNonPlaceScheduleItemSubmitState(true, 'create'), { disabled: true, label: '추가 중...' });
    assert.deepEqual(buildNonPlaceScheduleItemSubmitState(false, 'edit'), { disabled: false, label: '저장' });
    assert.deepEqual(buildNonPlaceScheduleItemSubmitState(true, 'edit'), { disabled: true, label: '저장 중...' });
  });
});
