# Feature Slice: 모임 단위 초대와 멤버 관리로 전환

## Metadata

- GitHub Issue: #456
- Parent Epic: #449
- Status: Implemented
- Created: 2026-08-23
- Updated: 2026-08-23

## Source

- Issue: #456 — `[모임 전환] 모임 단위 초대와 멤버 관리로 전환`
- Meeting detail: `docs/features/0455-meeting-detail.md`
- Event-first trip creation: `docs/features/0454-event-first-trip-creation.md`
- API source of truth: `packages/api-contract/openapi.yaml`

## Summary

Saved meeting detail becomes the primary collaboration surface for inviting people and managing meeting membership. Owners create meeting-scoped invite links, accepting the link adds the authenticated user as a meeting member, and future schedules created in that saved meeting include current meeting members without another trip invite. Existing trip invite links remain accepted through the same public invite URL for compatibility.

## Scope

### In

- Add meeting-scoped invite persistence and owner-only create/reuse endpoint for saved meetings.
- Extend the public invite acceptance path so meeting invite tokens are accepted before falling back to legacy trip invite tokens.
- Add minimal meeting member management:
  - owners can remove non-owner members;
  - non-owner members can leave;
  - owners cannot leave/remove the owner until a future transfer flow exists.
- Update meeting detail mobile state to show owner invite actions, member leave/remove affordances, and meeting-first invite copy.
- Keep one-off meetings hidden and unavailable for meeting invite/member management endpoints.
- Keep legacy trip invite creation/acceptance working for existing trip participant screens.

### Out

- Owner transfer flow.
- Fine-grained roles beyond owner/member.
- Pending invitee list or invitation revocation UI beyond current active-link reuse/expiry.
- Adding accepted meeting members to already-existing trip/event participants.
- Selecting a subset of meeting members per event (#457).
- Non-trip outing creation/detail (#459).

## Decisions

- `/invite/{token}` remains the share URL for both meeting and legacy trip invite tokens.
- `POST /invites/{token}/accept` accepts meeting invite tokens first and falls back to legacy trip invite tokens.
- OpenAPI keeps the existing `acceptTripInvite` operationId for generated-client compatibility, but the response gains `scope: meeting | trip` and optional meeting/trip fields.
- Meeting invite creation is saved-meeting + owner-only. One-off meetings are not manageable or shareable through this endpoint.
- Meeting invite acceptance adds only a `meeting_members` row. Existing trip/event participants are not mutated.
- Removing/leaving a meeting deletes only the `meeting_members` row. Existing `event_participants.meeting_member_id` is set null by DB FK behavior, and trip participants remain untouched.
- Future trips in a saved meeting continue to seed current meeting members through the existing #454 create-trip behavior.
- Owner transfer is deferred; owner leave and owner removal return conflict.

## Acceptance Criteria

- [x] Owner can create or reuse a saved meeting invite link from meeting detail.
- [x] Non-owner meeting members cannot create saved meeting invite links.
- [x] Accepting a meeting invite makes the authenticated user a meeting member with role `member`.
- [x] Re-accepting a meeting invite by an existing meeting member returns idempotent success with `alreadyAccepted: true`.
- [x] Existing trip invite links still accept through the public invite route and return trip navigation.
- [x] Meeting membership and event/trip participation stay distinct: accepting/removing/leaving meeting membership does not mutate existing trip participants or event participants.
- [x] Future trip creation in an existing saved meeting continues to seed current meeting members.
- [x] Owner can remove a non-owner meeting member.
- [x] Non-owners cannot remove members.
- [x] Owner removal is rejected.
- [x] Non-owner members can leave a saved meeting.
- [x] Owner leave is rejected until owner transfer exists.
- [x] One-off meeting containers cannot create invites or be managed through saved meeting member endpoints.
- [x] Generated OpenAPI Go/TS and sqlc artifacts are up to date.

## API Changes

Add:

- `POST /meetings/{meetingId}/invites` → `CreateMeetingInviteResponse`
- `DELETE /meetings/{meetingId}/members/me` → 204
- `DELETE /meetings/{meetingId}/members/{memberId}` → 204
- `MeetingInvite`
- `CreateMeetingInviteResponse`
- `InviteScope`

Broaden `AcceptTripInviteResponse`:

```yaml
required:
  - scope
  - role
  - alreadyAccepted
properties:
  scope: meeting | trip
  meetingId?: string
  meetingName?: string
  tripId?: string
  tripName?: string
  role: owner | member
  alreadyAccepted: boolean
```

Update `/invites/{token}/accept` description to accept meeting-scoped tokens first, then legacy trip tokens.

## DB Changes

Add migration `00034_create_meeting_invites.sql`:

- `meeting_invites` table with:
  - `meeting_id` FK to `meetings(id)` with cascade delete;
  - opaque token, expiry, deactivation, created metadata;
  - token uniqueness;
  - one active invite per meeting partial unique index;
  - meeting/expires indexes.

Add sqlc queries for:

- create/reuse current meeting invite;
- accept meeting invite by token;
- delete meeting member by id within a saved meeting.

## Mobile Changes

- Add meeting invite API wrappers to `apps/mobile/lib/trips/meeting-api.ts`.
- Add meeting invite/member helper logic to `apps/mobile/lib/trips/meeting-detail.ts`.
- Update invite acceptance helpers in `apps/mobile/lib/trips/invite.ts` for meeting vs trip scopes.
- Update `apps/mobile/app/invite/[token].tsx` to route meeting accept success to `/meetings/{meetingId}` and trip accept success to `/trips/*`.
- Update `apps/mobile/app/meetings/[meetingId].tsx` to:
  - load current auth user;
  - show owner invite card;
  - support copy/Kakao/fallback share for meeting invite links;
  - show owner remove action for non-owner members;
  - show non-owner leave action.

## Test Plan

- Contract/source tests:
  - meeting invite endpoint exists;
  - generic accept response has scope and optional meeting/trip fields;
  - mobile meeting detail screen includes invite/member management copy.
- API service tests:
  - owner creates meeting invite;
  - member cannot create meeting invite;
  - meeting invite acceptance creates member and is idempotent;
  - legacy trip invite fallback still works;
  - remove/leave owner/member policies.
- API server tests:
  - create meeting invite response/status;
  - accept meeting invite response/status;
  - remove/leave forbidden/conflict/not found mapping.
- Storage integration test:
  - saved meeting invite lifecycle and member deletion semantics; skipped without `DATABASE_URL`.
- Mobile helper tests:
  - meeting invite view-model and share copy;
  - accept response routing for meeting and trip;
  - member management permissions.
- Full generated/API/mobile verification.

## Verification Record

- `cd apps/mobile && node --import tsx --test lib/trips/meeting-detail.test.mts lib/trips/invite.test.mts lib/app-info/meeting-invites.test.mts` — passed.
- `CGO_ENABLED=0 go test ./internal/meeting ./internal/server -run 'TestCreateMeetingInvite|TestAcceptMeetingInvite|TestRemoveAndLeave|TestMeetingInvite|TestMeetingInviteAcceptFallsBack' -count=1` from `apps/api` — passed.
- `CGO_ENABLED=0 pnpm verify:generated` — passed.
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test` — passed.
- `CGO_ENABLED=0 pnpm --filter @i-um/api build` — passed.
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test` — passed.
- `pnpm --filter @i-um/mobile typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — passed.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` — passed.
- `pnpm harness:validate` — passed.
- `git diff --check` — passed.
- DB migration smoke: `db:migrate`, `db:rollback`, `db:migrate` to version 34 — passed.
- `DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run 'TestDeleteAccountTransactionAnonymizesSharedTripsAndInvalidatesAuth|TestMeetingRepositoryMeetingInviteLifecycleAndMemberDeletion' -count=1` from `apps/api` — passed.

## Manual Smoke

- Android: not run; no simulator/device session in this environment.
- iOS: not run; no simulator/device session in this environment.

## Open Questions

None blocking. Owner transfer and pending invitee management are deferred follow-up work.
