import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AcceptTripInviteResponse, CreateTripInviteResponse, GetTripDetailResponse } from '@i-um/api-contract';

import {
  buildFallbackShareContent,
  buildInviteAuthRequiredViewModel,
  buildInviteCopyText,
  buildInviteInvalidViewModel,
  buildInviteLoginRequiredViewModel,
  buildKakaoInviteTemplate,
  canCreateTripInvite,
  getInviteAcceptErrorViewModel,
  getInviteActionErrorMessage,
  getKakaoShareFailureMessage,
  isInviteTokenFormatValid,
  toInviteAcceptViewModel,
  toInviteViewModel,
  toKakaoInviteRedirectPath,
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
  participantSummary: { totalCount: 1, previewNames: ['민수'], overflowCount: 0 },
  days: [],
};

const validInviteToken = 'valid-token-abcdefghijklmnopqrstuvwxyz123456';

const inviteResponse: CreateTripInviteResponse = {
  created: true,
  invite: {
    id: 'invite-1',
    tripId: 'trip-1',
    token: validInviteToken,
    inviteUrl: `https://invite.i-um.app/invite/${validInviteToken}`,
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
  assert.equal(created.token, validInviteToken);
  assert.equal(created.inviteUrl, `https://invite.i-um.app/invite/${validInviteToken}`);
  assert.equal(created.statusLabel, '초대 링크가 준비됐어요.');
  assert.match(created.expiryLabel, /만료:/);

  const reused = toInviteViewModel({ ...inviteResponse, created: false });
  assert.equal(reused.statusLabel, '기존 초대 링크를 불러왔어요.');
});

test('copy and share helpers use Chit invite copy and inviteUrl rather than the raw token', () => {
  const input = { tripName: '제주 여행', inviteUrl: inviteResponse.invite.inviteUrl };

  assert.equal(buildInviteCopyText(input.inviteUrl), input.inviteUrl);

  const kakaoPayload = buildKakaoInviteTemplate(input);
  assert.equal(kakaoPayload.text, `일정 초대가 왔어요.\n제주 여행\n칫에서 함께 일정을 확인해요.\n${input.inviteUrl}`);
  assert.equal(kakaoPayload.link.mobileWebUrl, input.inviteUrl);
  assert.equal(kakaoPayload.buttons?.[0]?.title, '칫에서 참여하기');
  assert.equal(kakaoPayload.buttons?.[0]?.link.webUrl, input.inviteUrl);

  const fallbackPayload = buildFallbackShareContent(input);
  assert.equal(fallbackPayload.title, '칫 일정 초대');
  assert.equal(
    fallbackPayload.message,
    `일정 초대가 왔어요.\n제주 여행\n칫에서 함께 일정을 확인해요.\n${input.inviteUrl}`,
  );
  assert.equal(fallbackPayload.url, input.inviteUrl);
});

test('Kakao installed-app callback carries the invite token back to the invite route', () => {
  const input = { tripName: '제주 여행', inviteUrl: inviteResponse.invite.inviteUrl };
  const expectedExecutionParams = [{ key: 'inviteToken', value: validInviteToken }];

  const kakaoPayload = buildKakaoInviteTemplate(input);

  assert.deepEqual(kakaoPayload.link.iosExecutionParams, expectedExecutionParams);
  assert.deepEqual(kakaoPayload.link.androidExecutionParams, expectedExecutionParams);
  assert.deepEqual(kakaoPayload.buttons?.[0]?.link.iosExecutionParams, expectedExecutionParams);
  assert.deepEqual(kakaoPayload.buttons?.[0]?.link.androidExecutionParams, expectedExecutionParams);
  assert.equal(toKakaoInviteRedirectPath({ inviteToken: validInviteToken }), `/invite/${validInviteToken}`);
  assert.equal(
    toKakaoInviteRedirectPath({ inviteToken: [validInviteToken, 'ignored'] }),
    `/invite/${validInviteToken}`,
  );
  assert.equal(toKakaoInviteRedirectPath({ inviteToken: 'short' }), null);
});

test('failure copy separates invite API errors from Kakao share fallback guidance', () => {
  assert.equal(getInviteActionErrorMessage({ code: 'FORBIDDEN' }), '일정 주최자만 초대 링크를 만들 수 있어요.');
  assert.equal(getInviteActionErrorMessage({ code: 'NOT_FOUND' }), '일정을 찾을 수 없어요.');
  assert.equal(
    getInviteActionErrorMessage(new Error('network')),
    '초대 링크를 만들 수 없어요. 잠시 후 다시 시도해주세요.',
  );
  assert.equal(
    getKakaoShareFailureMessage(),
    '카카오톡 공유를 열 수 없어요. 링크를 복사하거나 다른 앱으로 공유해보세요.',
  );
});

test('invite accept token validation follows API token format', () => {
  assert.equal(isInviteTokenFormatValid('valid-token-abcdefghijklmnopqrstuvwxyz123456'), true);
  assert.equal(isInviteTokenFormatValid('short'), false);
  assert.equal(isInviteTokenFormatValid('invalid-token.with-dot-abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(isInviteTokenFormatValid(' '), false);
});

test('invite accept responses map to success and already accepted copy', () => {
  const accepted: AcceptTripInviteResponse = {
    scope: 'trip',
    tripId: 'trip-1',
    tripName: '제주 여행',
    role: 'member',
    alreadyAccepted: false,
  };
  assert.deepEqual(toInviteAcceptViewModel(accepted), {
    kind: 'accepted',
    title: '일정에 참여했어요.',
    message: '제주 여행 일정을 함께 볼 수 있어요.',
    primaryAction: 'viewTrip',
    primaryLabel: '일정 보기',
    tripId: 'trip-1',
    tripName: '제주 여행',
  });

  const member = toInviteAcceptViewModel({ ...accepted, alreadyAccepted: true });
  assert.equal(member.kind, 'alreadyMember');
  assert.equal(member.title, '이미 참여 중인 일정이에요.');

  const owner = toInviteAcceptViewModel({ ...accepted, role: 'owner', alreadyAccepted: true });
  assert.equal(owner.kind, 'ownerAlready');
  assert.equal(owner.title, '이미 주최자로 참여 중인 일정이에요.');
});

test('meeting invite accept responses map to meeting detail navigation', () => {
  const accepted: AcceptTripInviteResponse = {
    scope: 'meeting',
    meetingId: 'meeting-1',
    meetingName: '등산 모임',
    role: 'member',
    alreadyAccepted: false,
  };

  assert.deepEqual(toInviteAcceptViewModel(accepted), {
    kind: 'acceptedMeeting',
    title: '모임에 참여했어요.',
    message: '등산 모임 모임의 일정과 멤버를 함께 볼 수 있어요.',
    primaryAction: 'viewMeeting',
    primaryLabel: '모임 보기',
    meetingId: 'meeting-1',
    meetingName: '등산 모임',
  });

  const already = toInviteAcceptViewModel({ ...accepted, alreadyAccepted: true });
  assert.equal(already.kind, 'alreadyMeetingMember');
  assert.equal(already.title, '이미 참여 중인 모임이에요.');
});

test('invite accept login and invalid helpers expose required CTA copy', () => {
  assert.deepEqual(buildInviteLoginRequiredViewModel(), {
    kind: 'loginRequired',
    title: '로그인이 필요합니다.',
    message: '로그인하면 이 초대 링크로 돌아와요.',
    primaryAction: 'login',
    primaryLabel: '로그인하기',
    secondaryAction: 'home',
    secondaryLabel: '홈으로',
  });
  assert.equal(buildInviteAuthRequiredViewModel().title, '다시 로그인해주세요.');
  assert.equal(buildInviteAuthRequiredViewModel().message, '로그인하면 이 초대 링크로 돌아와요.');
  assert.equal(buildInviteInvalidViewModel().message, '링크가 잘못되었거나 더 이상 사용할 수 없어요.');
});

test('invite accept API errors map to expired invalid auth and retryable states', () => {
  assert.equal(
    getInviteAcceptErrorViewModel({ status: 410, body: { error: { code: 'INVITE_EXPIRED' } } }).kind,
    'expired',
  );
  assert.equal(
    getInviteAcceptErrorViewModel({ status: 404, body: { error: { code: 'INVITE_NOT_FOUND' } } }).kind,
    'invalid',
  );
  assert.equal(
    getInviteAcceptErrorViewModel({ status: 400, body: { error: { code: 'VALIDATION_ERROR' } } }).kind,
    'invalid',
  );
  assert.equal(
    getInviteAcceptErrorViewModel({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }).kind,
    'authRequired',
  );
  assert.equal(getInviteAcceptErrorViewModel({ code: 'INVALID_REFRESH_TOKEN' }).kind, 'authRequired');
  assert.equal(getInviteAcceptErrorViewModel(new Error('network')).kind, 'retryableError');
});
