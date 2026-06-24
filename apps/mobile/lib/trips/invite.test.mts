import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CreateTripInviteResponse, GetTripDetailResponse } from '@i-um/api-contract';

import {
  buildFallbackShareContent,
  buildInviteCopyText,
  buildKakaoInviteTemplate,
  canCreateTripInvite,
  getInviteActionErrorMessage,
  getKakaoShareFailureMessage,
  invitePlaceholderMessage,
  toInviteViewModel,
} from './invite.ts';

const tripDetail: GetTripDetailResponse = {
  trip: {
    id: 'trip-1',
    name: '제주 여행',
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    defaultCurrency: 'KRW',
    createdBy: 'owner-1',
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  participantSummary: { total: 1, owners: 1, members: 0 },
  days: [],
};

const inviteResponse: CreateTripInviteResponse = {
  created: true,
  invite: {
    id: 'invite-1',
    tripId: 'trip-1',
    token: 'invite-token',
    inviteUrl: 'https://invite.i-um.app/invite/invite-token',
    expiresAt: '2026-06-30T15:00:00Z',
    createdAt: '2026-06-23T15:00:00Z',
    createdBy: 'owner-1',
  },
};

test('invite action is visible only to the trip Owner', () => {
  assert.equal(canCreateTripInvite(tripDetail, 'owner-1'), true);
  assert.equal(canCreateTripInvite(tripDetail, 'member-1'), false);
  assert.equal(canCreateTripInvite(null, 'owner-1'), false);
});

test('invite response maps to copyable view model with created/reused status', () => {
  const created = toInviteViewModel(inviteResponse);
  assert.equal(created.token, 'invite-token');
  assert.equal(created.inviteUrl, 'https://invite.i-um.app/invite/invite-token');
  assert.equal(created.statusLabel, '초대 링크가 준비됐어요.');
  assert.match(created.expiryLabel, /만료:/);

  const reused = toInviteViewModel({ ...inviteResponse, created: false });
  assert.equal(reused.statusLabel, '기존 초대 링크를 불러왔어요.');
});

test('copy and share helpers use inviteUrl rather than the raw token', () => {
  const input = { tripName: '제주 여행', inviteUrl: inviteResponse.invite.inviteUrl };

  assert.equal(buildInviteCopyText(input.inviteUrl), input.inviteUrl);

  const kakaoPayload = buildKakaoInviteTemplate(input);
  assert.equal(kakaoPayload.link.mobileWebUrl, input.inviteUrl);
  assert.equal(kakaoPayload.buttons?.[0]?.link.webUrl, input.inviteUrl);
  assert.equal(kakaoPayload.text.endsWith(input.inviteUrl), true);

  const fallbackPayload = buildFallbackShareContent(input);
  assert.equal(fallbackPayload.url, input.inviteUrl);
  assert.equal(String(fallbackPayload.message).includes(input.inviteUrl), true);
});

test('failure copy separates invite API errors from Kakao share fallback guidance', () => {
  assert.equal(getInviteActionErrorMessage({ code: 'FORBIDDEN' }), '여행 Owner만 초대 링크를 만들 수 있어요.');
  assert.equal(getInviteActionErrorMessage({ code: 'NOT_FOUND' }), '여행을 찾을 수 없어요.');
  assert.equal(getInviteActionErrorMessage(new Error('network')), '초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.');
  assert.equal(getKakaoShareFailureMessage(), '카카오톡 공유를 열 수 없어요. 링크를 복사하거나 다른 앱으로 공유해보세요.');
});

test('placeholder route copy states acceptance is deferred', () => {
  assert.equal(invitePlaceholderMessage, '초대 링크를 열었어요. 참여 기능은 곧 지원될 예정이에요.');
});
