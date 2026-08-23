# Verification — 0459 Outing Event MVP

## RED checks observed

- `cd apps/mobile && node --import tsx --test lib/trips/outing-event.test.mts lib/app-info/outing-events.test.mts`
  - Failed before implementation because `outing-event` helper and `/events` routes did not exist and OpenAPI lacked outing metadata.
- `cd apps/api && CGO_ENABLED=0 go test ./internal/meeting -run TestCreateOutingEventWithExistingMeetingMetadataAndSelectedParticipants -count=1`
  - Failed before implementation because `CreateEventInput/CreateEventRecord` lacked outing metadata and `ParticipantMemberIDs`.

## Focused checks

- `cd apps/mobile && node --import tsx --test lib/trips/outing-event.test.mts lib/app-info/outing-events.test.mts`
- `cd apps/api && CGO_ENABLED=0 go test ./internal/meeting ./internal/server -run 'TestCreateOutingEvent|TestCreateEventWithExistingMeetingRequiresMembershipAndGetEventRequiresParticipant|TestCreateMeetingAndOneOffEventVisibility' -count=1`
- `cd apps/api && DATABASE_URL='postgres://ium:ium@localhost:5432/ium?sslmode=disable' CGO_ENABLED=0 go test ./internal/storage -run TestMeetingRepositoryCreatesEventsAndHidesOneOffMeetingsFromSavedList -count=1`

## Full gates

- `CGO_ENABLED=0 pnpm verify:generated`
- `env -u DATABASE_URL CGO_ENABLED=0 pnpm --filter @i-um/api test`
- `CGO_ENABLED=0 pnpm --filter @i-um/api build`
- `env -u EXPO_PUBLIC_RECEIPT_OCR_MODE pnpm --filter @i-um/mobile test`
- `pnpm --filter @i-um/mobile typecheck`
- `pnpm lint`
- `pnpm format:check`
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .`
- `pnpm harness:validate`
- `git diff --check`

## Manual smoke

- Android: not run; no simulator/device session available.
- iOS: not run; no simulator/device session available.
