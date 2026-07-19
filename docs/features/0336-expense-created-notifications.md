# Feature Slice: F-336 지출 생성 알림

## Metadata

- GitHub Issue: #336
- Status: Planned
- Created: 2026-07-19
- Updated: 2026-07-19
- Run: `.harness/runs/20260719-issue-336-expense-notifications`
- Provider evidence: Ouroboros interview `interview_20260719_043504`

## Goal

지출이 등록되면 돈과 직접 관련된 사람인 결제자와 분할 대상자가 빠르게 인지할 수 있도록, `expense.created` 인앱 알림 기록과 OS push 알림 기반을 제공한다.

이 slice는 향후 일정 변경, 정산 요청, 참여자 변경 등 다른 알림 이벤트가 추가될 수 있도록 범용 notification event + user notification + push outbox 구조를 먼저 만든다. 단, #336에서 실제로 발송하는 이벤트는 `expense.created` 하나뿐이다.

## Product Decisions

- #336은 지출 생성 이벤트(`expense.created`)만 구현한다.
- 지출 수정/삭제, payer 변경, split participant 변경 알림은 별도 future event로 다룬다.
- 생성 알림은 나중에 분할 대상자가 수정되어도 다시 발송하지 않는다.
- 모든 여행 참여자에게 push하지 않는다. 알림 피로를 줄이고 돈과 직접 관련된 사람에게만 high-signal push를 보낸다.
- 인앱 알림 기록은 생성자 + 생성 시점 payer/split participant user의 distinct 집합에 생성한다.
- OS push outbox는 생성자를 제외한 생성 시점 payer/split participant user에게만 생성한다.
- 생성자도 payer/split 대상이면 인앱 row는 1개만 만들고 push는 만들지 않는다.
- unrelated trip participant는 인앱 알림과 push 모두 받지 않는다.
- recipient와 알림 표시 내용은 생성 시점 snapshot으로 저장한다.
- 이후 참여자가 제거되어도 기존 notification history는 유지한다.
- 삭제되었거나 접근할 수 없는 지출 알림을 누르면 정산 탭 지출 내역으로 이동하고 `지출을 더 이상 볼 수 없어요. 지출 내역으로 이동했어요.` 같은 fallback copy를 보여준다.
- Kafka, Pub/Sub, 외부 event broker는 MVP 범위가 아니다. Postgres transactional outbox + worker/retry로 시작한다.

## Scope

### In

- DB-backed generic notification event pipeline:
  - `notification_events`
  - `user_notifications`
  - `user_push_tokens`
  - `notification_push_outbox`
- Authenticated push token registration/revocation API.
- Authenticated in-app notification list/read API.
- `CreateQuickExpense` and `CreateTripExpense` transaction에서 `expense.created` event/user notification/outbox 생성.
- Expo push provider behind an interface.
- Separate push outbox worker command intended to run as a Cloud Run Job, with claim/retry/dead-letter/invalid-token handling.
- Cloud Scheduler/Cloud Run Job deployment shape for periodic outbox draining.
- Mobile push permission/token registration from an explicit notification surface.
- Minimal MyPage notification entry + notification history screen.
- Push notification tap routing to settlement expense history by `expenseId`.
- Deleted/inaccessible expense fallback copy.
- API contract/generated/server/mobile tests and privacy assertions.

### Out

- Expense update/delete notifications.
- Split participant/payer changed notifications.
- Settlement request notifications.
- Chat, comments, read receipts, or real-time notification streaming.
- Bank transfer/payment completion notifications.
- Full preferences such as per-trip mute, quiet hours, digest, or badge count sync.
- Kafka/PubSub/external broker deployment.

## Recipient Matrix

| Recipient category | In-app `user_notifications` | OS push outbox | Notes |
|---|---:|---:|---|
| Creator | Yes | No | Persist self-created activity/history. |
| Payer user | Yes | Yes unless creator | Creation-time snapshot. |
| Split participant user | Yes | Yes unless creator | Creation-time snapshot. |
| Payer and split same user | One row | One push target unless creator | Deduped by user. |
| Unrelated trip participant | No | No | MVP avoids noisy all-trip push. |
| Later removed recipient | Existing row remains | Existing outbox follows retry/failure state | Tap respects current authorization. |

## Notification Content

Use the same minimal copy for push and in-app list:

```text
{actorDisplayName}님이 지출을 등록했어요 · {expenseTitle} {formattedAmount}
```

Examples:

```text
민수님이 지출을 등록했어요 · 도톤보리 식사 18,500원
지영님이 지출을 등록했어요 · 항공권 320,000원
```

Do not include:

- 개인별 split amount/detail
- memo 전문
- receipt/OCR text
- account/bank/payment information
- settlement transfer suggestions

## API Changes

OpenAPI is the source of truth.

Add:

- `POST /me/push-tokens`
  - Registers or refreshes the authenticated user's current app installation token.
  - Request: `installationId`, `expoPushToken`, `platform`.
  - Registration for the current user supersedes/revokes any active row with the same token for another user/installation.
- `DELETE /me/push-tokens/{installationId}`
  - Revokes the authenticated user's token for the app installation on logout or permission disable.
- `GET /me/notifications`
  - Returns authenticated user's notification history with pagination.
- `PATCH /me/notifications/{notificationId}/read`
  - Marks one notification read.

Notification list item includes:

- `id`
- `eventType`
- `title`
- `body`
- `actionPath`
- `createdAt`
- `readAt`
- minimal `snapshot` fields needed by mobile routing/display

## DB Changes

Add goose migration `00028_create_notifications.sql`.

### `notification_events`

Immutable event-level record.

Important columns:

- `event_type`: initially `expense.created`
- `trip_id`
- `actor_user_id`
- `entity_type`: initially `expense`
- `entity_id`: no FK to `expenses`, so deleted expenses can still be represented historically
- `idempotency_key`: unique, e.g. `expense.created:<expense_id>`
- `payload_json`
- `created_at`

### `user_notifications`

User-level in-app history and read state.

Important columns:

- `event_id`
- `user_id`
- `trip_id`
- `recipient_reason`: `creator`, `payer`, `split_participant`, `payer_split_participant`
- `title`
- `body`
- `action_path`
- `snapshot_json`
- `read_at`
- `created_at`
- `unique(event_id, user_id)`

### `user_push_tokens`

Expo push tokens per app installation.

Important columns:

- `user_id`
- `installation_id`
- `expo_push_token`
- `platform`: `ios` or `android`
- `status`: `active`, `revoked`, `invalid`
- `last_registered_at`
- `revoked_at`
- `invalidated_at`
- `unique(user_id, installation_id)`
- active token uniqueness/superseding policy for shared/user-switched devices

### `notification_push_outbox`

Retryable push queue.

Important columns:

- `notification_id`
- `push_token_id`
- `user_id`
- `provider`: `expo`
- `expo_push_token_snapshot`
- `title`
- `body`
- `data_json`
- `status`: `pending`, `running`, `succeeded`, `failed`, `dead`, `skipped`
- `attempts`
- `next_attempt_at`
- `last_error`
- `provider_message_id`
- `processed_at`
- pending/failed claim index

## Push Delivery Model

- Expense creation transaction inserts expense, splits, notification event, user notification rows, and push outbox rows together.
- Push is sent only after commit by a separate worker command, not by an API request goroutine.
- MVP deployment target is a Cloud Run Job. Each job invocation claims due outbox rows, processes batches until no due rows or a time/batch limit is reached, then exits.
- Cloud Scheduler can trigger the job every 1 minute for staging/prod; expected push latency is therefore eventual and usually bounded by the scheduler interval plus provider latency.
- Worker claim queries must be safe when job invocations overlap, using status/next-at indexes, row locking, and `SKIP LOCKED`-style concurrency control.
- Retry backoff starts around 1 minute and grows up to 60 minutes.
- After max attempts, row becomes `dead` and keeps `last_error`.
- Invalid/unregistered Expo tokens mark the token `invalid` and terminally stop that outbox row.
- Push delivery failure never changes the expense API response and never rolls back expense creation.

## Mobile UX

- MyPage settings includes an `알림` row.
- Notification screen shows in-app notification history and a push permission state/CTA.
- Permission prompt is user-initiated from the notification surface, not an unexpected startup prompt.
- When permission is granted, mobile obtains Expo push token and calls `POST /me/push-tokens`.
- On logout, permission disable, or user switch, mobile calls token revocation for the current installation when possible.
- App root listens for notification responses and routes action paths.
- Settlement tab accepts `expenseId` from notification action paths, selects the matching expense section when found, and shows unavailable fallback when not found/access denied.

## Worker Deployment Decision: Cloud Run Jobs

Cloud Run Jobs exist and fit this slice better than an API-process goroutine. Implement the push sender as a finite `cmd/notification-worker` command that reuses the same notification worker package and can run in the same container image with a different command/args.

For staging/prod, use Cloud Scheduler to invoke the Cloud Run Job on a short interval such as every 1 minute. This avoids depending on Cloud Run service background CPU, request traffic, or instance lifetime. The outbox table remains the reliability boundary: if no job is running, rows stay `pending`; if a job is killed mid-send, stuck `running` rows are recovered by timeout/retry policy.

If product requirements later demand seconds-level delivery latency instead of minute-level eventual delivery, move the same worker package to an always-on Cloud Run service with min instances/CPU always allocated, or revisit Cloud Tasks/PubSub/Kafka depending on the number of consumers and fan-out requirements.

## Architecture Decision: Why not Kafka now?

Use a DB-backed transactional outbox plus Cloud Run Job worker for this slice.

Kafka or a managed event bus is common when a product has many independent consumers, high event volume, replay requirements, or separate service/team boundaries. i-um currently has one Go API, one Postgres database, and one mobile client. The key correctness requirement is atomicity with expense creation; a Postgres transaction plus outbox rows handles that directly.

Kafka would add broker operations, partitions, retention, schema compatibility, consumer lag monitoring, dead-letter handling, replay tooling, local development overhead, and incident response. It also would not make push exactly-once, because push providers and mobile devices are still retry/failure-prone. We would still need idempotency, outbox state, and invalid-token handling.

Reconsider Kafka/PubSub when:

- multiple backend services independently consume the same domain events;
- analytics/audit/recommendation/email/notification consumers need durable replay;
- event fan-out or throughput makes DB polling a measurable bottleneck;
- event ordering by trip/user becomes a core cross-service requirement;
- notification delivery needs to be lower-latency or more continuously available than a scheduled Cloud Run Job;
- the team has monitoring/schema/dead-letter operations mature enough for a broker.

Until then, keep event boundaries clean so a future outbox publisher can publish `notification_events` to Kafka without changing expense write paths.

## Acceptance Criteria

- [ ] AC-01: Quick expense creation creates exactly one `expense.created` notification event.
- [ ] AC-02: General/trip expense creation creates exactly one `expense.created` notification event.
- [ ] AC-03: User notification rows are created for every distinct creation-time payer/split participant user plus the creator.
- [ ] AC-04: Unrelated trip participants do not receive user notification or push outbox rows.
- [ ] AC-05: Creator does not receive OS push even when creator is payer or split participant.
- [ ] AC-06: Payer/split overlap and duplicate split inputs do not create duplicate user notification rows.
- [ ] AC-07: Notification copy exposes only actor, expense title, amount, and currency.
- [ ] AC-08: `includeInSettlement=false` expenses still notify target users.
- [ ] AC-09: Missing permission/token or push delivery failure does not roll back expense creation.
- [ ] AC-10: Push outbox retry/dead-letter/invalid-token policy is implemented and tested.
- [ ] AC-11: Push token registration/revocation handles logout/user-switch safety.
- [ ] AC-12: Notification tap routes to the expense context when accessible.
- [ ] AC-13: Deleted/inaccessible expense tap falls back to settlement expense history with unavailable copy.
- [ ] AC-14: Removed/historical recipients keep notification history, while navigation respects current authorization.
- [ ] AC-15: Core notification data model can support future event types without rewriting expense creation.

## Regression Test Plan

| Behavior | Layer | Command |
|---|---|---|
| OpenAPI notification/token schemas and generated clients | Contract/generated | `pnpm generate && pnpm verify:generated` |
| Notification tables, constraints, and indexes | DB/sqlc/storage | `pnpm --filter @i-um/api test` |
| Expense-created recipient policy and dedupe | API service/storage | `pnpm --filter @i-um/api test` |
| Transactional event/notification/outbox creation | API storage | `pnpm --filter @i-um/api test` |
| Push token register/revoke and notification list/read APIs | API handler/service | `pnpm --filter @i-um/api test` |
| Push worker retry/dead/invalid-token behavior | API worker/provider | `pnpm --filter @i-um/api test` |
| Mobile permission/token registration states | Mobile helpers | `pnpm --filter @i-um/mobile test` |
| Mobile notification action routing and fallback | Mobile helpers/settle view-model | `pnpm --filter @i-um/mobile test` |
| Mobile screens compile | Mobile typecheck | `pnpm --filter @i-um/mobile typecheck` |
| Privacy copy excludes memo/receipt/split detail | API/mobile unit/static review | `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test` |

## Open Questions

None.

## Follow-up Issues

- `expense.split_participants_changed` notification.
- `expense.payer_changed` notification.
- `expense.updated` and `expense.deleted` notifications.
- Settlement request notification.
- Notification preferences, per-trip mute, quiet hours, unread badge sync.
- Broker/event-stream adoption if the DB outbox becomes insufficient.
