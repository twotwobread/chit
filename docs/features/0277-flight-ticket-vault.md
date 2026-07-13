---
schema_version: feature-spec.v1
id: F277-flight-ticket-vault
title: Trip flight ticket vault and private boarding-pass attachment
status: approved
summary: Add a trip-level flights-only ticket vault with shared flight metadata visible to trip participants, passenger-private reservation/boarding-pass details, private GCS image storage, short-lived signed URL access, and Today operational flight surfacing.
scope:
  in:
    - Trip AppBar `항공권` action that opens a full-screen flight ticket vault.
    - Shared flight create/list/detail API and mobile UI for flights only.
    - Passenger list per shared flight using existing trip participants.
    - Passenger-private personal flight detail for reservation number, seat, optional check-in URL, and one image attachment.
    - Private GCS object storage for boarding-pass/check-in images with DB object metadata only.
    - Short-lived signed URL generation only when the owning passenger opens their boarding pass.
    - Safe cleanup scheduling for replaced/deleted/orphaned boarding-pass GCS objects.
    - Today flight card/action from 24 hours before departure and companion same-day arrival context without personal details.
  out:
    - Other transport modes, lodging/ticket vaults beyond flights, OCR, automatic flight lookup/autofill, airport autocomplete, PDFs/files, multiple attachments, delegated entry of another passenger's private detail, calendar import/export, generic place-less schedule rows, shared flight edit/delete after creation.
acceptance_criteria:
  - AC-01: A trip-level AppBar action labeled `항공권` appears left of the companions/profile button and opens a full-screen flight vault without changing the bottom tabs.
  - AC-02: A current trip participant can create a shared flight with display title, optional flight number, departure/arrival airport text, optional airport codes, departure/arrival airport-local date/time/time zone, and passenger participants from the current trip.
  - AC-03: The API stores and returns both airport-local ticket times and absolute UTC instants; display uses airport-local times, never the user's current device/Korea time conversion.
  - AC-04: Trip participants can list/detail shared flight data and passenger lists for their trip.
  - AC-05: Only a passenger on the flight can create/update/read their own personal reservation number, seat, check-in URL, and boarding-pass metadata.
  - AC-06: Other trip participants, trip owner, flight creator, and travel leader cannot read another passenger's personal reservation fields or boarding-pass metadata beyond a non-sensitive passenger list.
  - AC-07: A passenger can attach, open, replace, and delete exactly one image boarding pass/check-in attachment for their own flight detail.
  - AC-08: Boarding-pass upload accepts only JPEG, PNG, or WebP images up to 10 MiB; invalid type/size is rejected before DB metadata is exposed.
  - AC-09: Boarding-pass image bytes are stored in a private GCS bucket; DB stores bucket/object key/generation/content type/byte size/upload timestamp metadata only.
  - AC-10: The API returns a short-lived signed URL only from an explicit own-boarding-pass open request and never includes raw object keys or signed URLs in list/detail responses.
  - AC-11: Replace/delete schedules cleanup for old GCS objects in the same DB transaction that changes metadata; best-effort deletion can mark the job done after commit.
  - AC-12: Removing a trip participant or deleting a trip does not break existing flows and schedules cleanup for affected boarding-pass objects before deleting DB rows.
  - AC-13: Today shows my operational flight starting 24 hours before departure, with primary action `탑승권 열기` when an image exists and `탑승권 추가` when it does not.
  - AC-14: Today can show companion same-day arrival summaries from shared flight data/passenger names only; no reservation number, seat, check-in URL, object key, metadata, or signed URL leaks.
  - AC-15: Existing itinerary, map, expense, settlement, lodging, trip switching, and companions flows remain compatible.
implementation_notes:
  - Use a new API domain package such as `apps/api/internal/flight` instead of expanding the already-large trip service with all flight behavior.
  - Keep `apps/api/internal/storage` as the DB implementation for the new flight repository and cleanup-job repository.
  - Add a small object-store interface for boarding-pass operations so tests use fakes and production uses GCS.
  - Update OpenAPI first, then generate Go server and TypeScript client artifacts.
  - Use generated mobile client/types for JSON flight APIs. Binary upload may use the generated service if it supports Blob request bodies; otherwise use a thin authenticated helper that still uses generated response/request types.
  - Store airport-local date/time/time zone as source-of-truth display fields and store UTC instants for ordering/window calculations.
  - Validate IANA time zones with Go `time.LoadLocation` and reject invalid zones with 400.
  - Construct UTC instants server-side from local date/time/time zone; reject arrival instants that are not after departure instants.
  - `항공권` is the MVP AppBar label; longer-term `티켓 보관함` remains out of scope.
  - Shared flight edit/delete is intentionally out of MVP to avoid unresolved permission policy. Personal details and attachment management are in scope.
api_changes:
  - Add OpenAPI tag `Flights`.
  - `GET /trips/{tripId}/flights` -> `ListTripFlightsResponse` with shared flight summaries, passengers, and current user's `myPersonalDetail` summary only.
  - `POST /trips/{tripId}/flights` -> `CreateTripFlightResponse`; request includes shared flight fields and `passengerParticipantIds`.
  - `GET /trips/{tripId}/flights/{flightId}` -> `GetTripFlightResponse`; returns shared detail, passengers, and current user's full `myPersonalDetail` only when the current user is a passenger and has one.
  - `PUT /trips/{tripId}/flights/{flightId}/my-detail` -> `UpsertMyFlightPersonalDetailResponse`; JSON body contains `reservationNumber`, `seat`, and `checkInUrl`, each nullable to clear.
  - `PUT /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass` -> `UploadMyFlightBoardingPassResponse { personalDetail }`; raw binary body, `Content-Type` exactly `image/jpeg`, `image/png`, or `image/webp`, max 10 MiB, creates/replaces current passenger's one attachment.
  - Upload reads at most 10 MiB + 1 byte, rejects oversize with HTTP 413 and error code `UPLOAD_TOO_LARGE`, rejects unsupported/mismatched media with HTTP 415 and `UNSUPPORTED_BOARDING_PASS_MEDIA_TYPE`, and rejects missing storage configuration with HTTP 503 and `BOARDING_PASS_STORAGE_UNAVAILABLE`.
  - `DELETE /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass` -> 204; removes current passenger's attachment metadata and enqueues cleanup for the old object; deleting when no own attachment exists is a 204 no-op.
  - `POST /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass/open-url` -> `OpenMyFlightBoardingPassResponse` with `{ url, expiresAt, contentType, byteSize }`; URL TTL is at most 5 minutes.
  - Shared flight schemas include `id`, `displayTitle`, nullable `flightNumber`, `departure`, `arrival`, `passengers`, `createdByUserId`, `createdAt`, `updatedAt`; `departure`/`arrival` each include `airportText`, nullable `airportCode`, `localDate`, `localTime`, `timeZone`, and `at`.
  - Personal detail schemas include only the current passenger's `reservationNumber`, `seat`, `checkInUrl`, and `boardingPass` summary `{ exists, contentType, byteSize, uploadedAt }`; object bucket, object key, generation, and signed URL are excluded.
  - All endpoints require bearer auth and current trip participant authorization.
  - Shared flight list/detail requires current trip participant. Personal detail endpoints additionally require the current user's `trip_participants.id` to be in `flight_passengers` for that flight.
  - Error mapping: 400 validation, 401 unauthenticated, 403 not a trip participant or not the passenger for personal endpoints, 404 missing trip/flight/own attachment where applicable, 413 upload too large, 415 unsupported media type, 500 unexpected, 503 object storage unavailable.
db_changes:
  - Add `flights` table with `id`, `trip_id`, nullable `flight_number`, non-empty `display_title`, departure/arrival airport text/code, `departure_local_date`, `departure_local_time`, `departure_time_zone`, `departure_at`, `arrival_local_date`, `arrival_local_time`, `arrival_time_zone`, `arrival_at`, `created_by_user_id`, timestamps, `UNIQUE (id, trip_id)`, `CHECK (arrival_at > departure_at)`, length checks, and indexes by `(trip_id, departure_at, id)` and `(trip_id, arrival_at, id)`.
  - Add or reuse `UNIQUE (id, trip_id)` on `trip_participants` to support same-trip relational constraints.
  - Add `flight_passengers` table with `id`, `flight_id`, `trip_id`, `participant_id`, `added_by_user_id`, `created_at`, `UNIQUE (flight_id, participant_id)`, FK `(flight_id, trip_id) -> flights(id, trip_id) ON DELETE CASCADE`, FK `(participant_id, trip_id) -> trip_participants(id, trip_id) ON DELETE CASCADE`, and index `(trip_id, participant_id, flight_id)`.
  - Add `flight_personal_details` table with `id`, `flight_id`, `trip_id`, `passenger_participant_id`, `created_by_user_id`, nullable reservation fields, nullable boarding-pass bucket/object key/generation/content type/byte size/uploaded-at metadata, timestamps, `UNIQUE (flight_id, passenger_participant_id)`, FK `(flight_id, passenger_participant_id) -> flight_passengers(flight_id, participant_id) ON DELETE CASCADE`, and check constraints that attachment metadata columns are either all null or all present.
  - Add `storage_object_deletion_jobs` table for private object cleanup with bucket, object key, generation, reason enum (`replace`, `delete`, `participant_removed`, `trip_deleted`, `orphaned_upload`), status enum (`pending`, `running`, `succeeded`, `failed`), attempts, nextAttemptAt, lastError, created/updated/processed timestamps, and unique idempotency key over active pending/running object cleanup when practical.
  - Replace/delete attachment transactions must update personal-detail metadata and insert cleanup jobs for old objects before commit; participant removal and trip deletion transactions must synchronously enqueue jobs for affected attachment objects in the user-path DB transaction before deleting rows.
  - Object deletion itself is asynchronous/best-effort: the user-path mutation is successful after DB metadata is removed and cleanup jobs are durable; a lightweight API-process cleanup worker attempts pending jobs after commit, on startup, and then every 15 minutes.
  - Regenerate `apps/api/schema.sql` from migrations after adding goose migration(s).
mobile_changes:
  - Extend `AppBar` with an optional ticket action rendered left of the companion avatars; use a ticket/boarding-pass icon from `lucide-react-native` and accessibility label `항공권 보관함 열기`.
  - Add trip shell routes for `flights/index`, `flights/new`, and `flights/[flightId]` under `apps/mobile/app/trips/[tripId]/` without changing Today/Map/Itinerary/Settlement tabs.
  - Add `apps/mobile/lib/flights` or `apps/mobile/lib/trips/flight-*` helpers for flight API wrappers, time display, create form validation, vault view models, personal-detail view models, Today flight view model, and attachment state.
  - Add full-screen flight vault UI with states: loading; retryable error; empty with add-flight CTA; populated with `내 항공편` cards first and `동행 도착` cards second; card tap opens detail.
  - Add create flight screen with states: loading participants; editable form; validation errors; saving disabled/duplicate-submit protection; cancel/back confirmation only when dirty; save success navigates to created detail.
  - Add detail screen with states: loading; not found/forbidden; retryable error; shared route/time/passengers; privacy messaging; non-passenger shared-only view; passenger personal form with save/cancel dirty state; attachment section with no-attachment, attached, opening, uploading, deleting, and error states.
  - Attachment UX: picker cancel is silent; permission denial shows retryable helper; replace requires confirmation when an attachment exists; delete requires destructive confirmation; open failure discards any URL and shows retryable copy.
  - Add an image picker dependency through Expo for JPEG/PNG/WebP selection; validate type/size client-side before upload while preserving server authority.
  - Integrate flight data into Today: operational flight card above existing Today content; upcoming trip landing can be replaced/enhanced by flight card when a user's flight is within the 24h window.
test_plan:
  - Contract: OpenAPI generation includes flight schemas/endpoints and TS/Go generated artifacts remain reproducible with `pnpm generate` and `pnpm verify:generated`.
  - DB: migration apply/status/rollback/re-apply on test DB; constraints reject cross-trip passengers, duplicate passengers, personal details for non-passengers, duplicate personal details for one passenger/flight, invalid attachment metadata partial states, and arrival instants before departure.
  - API repository: create/list/detail flights; private detail only joins current passenger; replacement/deletion enqueues cleanup jobs; participant removal and trip deletion enqueue cleanup jobs before deleting rows.
  - API service validation: title/airports/time zones/time ordering/passengers; invalid IANA zone; empty passenger list; duplicate passenger ids; current user omitted from passenger list is allowed for shared create but does not create own detail.
  - API authorization matrix: trip non-participant denied; passenger can read/write own detail; flight creator who is not that passenger denied for personal endpoints; trip owner denied for another passenger detail; another passenger on same flight denied for target passenger detail; removed participant denied after removal.
  - API server: endpoint status/error mapping, raw image upload size/type handling, 10 MiB + 1 byte read limit, 413 `UPLOAD_TOO_LARGE`, 415 `UNSUPPORTED_BOARDING_PASS_MEDIA_TYPE`, 503 `BOARDING_PASS_STORAGE_UNAVAILABLE`, signed URL endpoint behavior, `Cache-Control: no-store` where practical, and no object key/signed URL/private field leak in shared JSON responses.
  - Object store: fake object store tests cover upload, signed URL TTL <= 5 minutes, single-object signed URL scope, delete success/failure, cleanup job status transitions, retry/idempotency, and orphaned upload cleanup attempt.
  - Mobile helpers: flight time display preserves airport-local strings across device time zones; vault/detail/Today view models hide other passengers' personal data; Today 24h-to-arrival+6h window and companion arrival logic are deterministic with injected `now`.
  - Mobile state tests: vault loading/error/empty/populated sections; create validation/saving/dirty cancel; detail passenger vs non-passenger views; attachment picker cancel, permission denied, upload oversize/type errors, replace confirmation, delete confirmation, open failure URL discard; Today no-eligible-flight hides flight card without breaking itinerary content.
  - Mobile UI/type: route helpers, AppBar ticket action, flight API wrappers, image picker/upload state, open-url no-persistence behavior, and generated client types compile.
  - Regression: existing trip participants removal, trip deletion, itinerary, Today, settlement, and companions tests still pass.
open_questions:
  - No blocking product questions. Deployment must provide `BOARDING_PASS_GCS_BUCKET` and a signing-capable service account before attachment open works outside tests.
provider:
  name: ouroboros-spec-author
  evidence:
    - GitHub Issue #277 body and acceptance criteria.
    - User conversation on 2026-07-13 approving data split and airport-local time plus UTC instant approach.
    - Narrow repo facts: existing trip participants, trip shell AppBar, Today tab/status landing, OpenAPI-generated clients, Go service/repository layering, and no existing GCS object-store abstraction.
---

# Feature Spec: F277 Flight Ticket Vault

## Product behavior

The flight ticket vault is a trip-level surface for flights only. It is not an itinerary item and does not revive generic place-less schedule rows. The vault separates shared flight context from personal reservation/boarding-pass material.

Shared flight data answers group questions such as “when does this participant arrive?” Personal reservation fields and boarding-pass images answer private questions for only the relevant passenger.

## Time semantics

Flight ticket times are airport-local. A Korean user entering an LAX departure should see and edit the LAX-local departure time shown on the ticket, not a Korea-time conversion.

For each departure/arrival endpoint, store both:

- local display fields: `localDate`, `localTime`, `timeZone`, airport text/code;
- absolute calculation field: `at` / DB `*_at` UTC instant.

The server validates IANA time zones, constructs instants from local fields, and rejects `arrivalAt <= departureAt`. List/detail responses return both forms. Mobile display defaults to local forms and may show a short helper such as `각 공항 현지시간 기준`.

### Canonical flight time fields and invariants

Each flight has exactly these time fields for departure and arrival:

| API field | DB column | Rule |
|---|---|---|
| `departure.localDate` | `departure_local_date date` | Required `YYYY-MM-DD`; copied from ticket-local departure date. |
| `departure.localTime` | `departure_local_time time` | Required `HH:mm`; copied from ticket-local departure time. |
| `departure.timeZone` | `departure_time_zone text` | Required IANA zone such as `Asia/Seoul`; service validates with `time.LoadLocation`. |
| `departure.at` | `departure_at timestamptz` | Required UTC instant derived by server from local date/time/time zone. |
| `arrival.localDate` | `arrival_local_date date` | Required `YYYY-MM-DD`; copied from ticket-local arrival date. |
| `arrival.localTime` | `arrival_local_time time` | Required `HH:mm`; copied from ticket-local arrival time. |
| `arrival.timeZone` | `arrival_time_zone text` | Required IANA zone; service validates with `time.LoadLocation`. |
| `arrival.at` | `arrival_at timestamptz` | Required UTC instant derived by server from local date/time/time zone. |

Invariants:

- Clients never submit `departure.at` or `arrival.at`; the API derives them.
- Response `*.at` values must match the local components interpreted in the declared zone.
- DB check enforces `arrival_at > departure_at`.
- Mobile sorting/window logic uses `*.at`; mobile display uses `localDate`, `localTime`, airport, and time-zone fields.
- Tests must include a cross-time-zone flight where device-local conversion would show a different date/time, proving display still uses airport-local fields.

DST and invalid local-time policy:

- Invalid IANA zones return HTTP 400 with `VALIDATION_ERROR`.
- Local date/time values that do not round-trip through the declared zone, such as DST spring-forward gaps, return HTTP 400 with `VALIDATION_ERROR`.
- DST fall-back overlaps are accepted and canonicalized by Go's time-zone rules for the declared location; the returned `*.at` is the authoritative calculation instant, while display remains the submitted local fields.
- MVP does not expose a UI for choosing the first vs second occurrence of an overlapped local time.

### Flight ordering examples

- Overnight flights are valid when the derived `arrival.at` is after `departure.at`, even if the arrival local date is the next calendar date.
- Date-line crossings are valid when the derived `arrival.at` is after `departure.at`, even if the arrival local date is the same or previous calendar date relative to departure local date.
- The API does not compare departure and arrival local calendar fields directly for ordering; only derived UTC instants determine ordering validity.

### Canonical wire time contract

- `localDate` wire format is exactly `YYYY-MM-DD`.
- `localTime` wire format is exactly `HH:mm` in 24-hour form; seconds are not accepted in MVP requests.
- `timeZone` is an IANA identifier string accepted by Go `time.LoadLocation`; abbreviations such as `PST` or `KST` are invalid.
- `at` wire format is OpenAPI `date-time` serialized as an RFC3339 UTC instant with `Z` when emitted by the API.
- Source of truth for presentation is `localDate` + `localTime` + `timeZone` + airport fields.
- Source of truth for calculations, sorting, and Today windows is `at`, derived server-side from the presentation source fields.

## API endpoint contracts

| Endpoint | Request | Response | Auth/validation |
|---|---|---|---|
| `GET /trips/{tripId}/flights` | No body. | `ListTripFlightsResponse { flights: FlightListItem[] }`. | Current trip participant only. Returns shared data plus current user's own `myPersonalDetail` summary; no other personal detail. |
| `POST /trips/{tripId}/flights` | JSON `CreateTripFlightRequest { displayTitle, flightNumber?, departure, arrival, passengerParticipantIds }`. | `CreateTripFlightResponse { flight: FlightDetail }`. | Current trip participant. `displayTitle` trim 1..80; `flightNumber` trim nullable max 20; airport text trim 1..120; airport code trim nullable max 8 uppercase-normalized; local date/time required; timeZone valid; passenger ids non-empty, distinct, current trip participants. |
| `GET /trips/{tripId}/flights/{flightId}` | No body. | `GetTripFlightResponse { flight: FlightDetail }`. | Current trip participant. Missing flight in trip returns 404. |
| `PUT /trips/{tripId}/flights/{flightId}/my-detail` | JSON `UpsertMyFlightPersonalDetailRequest { reservationNumber, seat, checkInUrl }`, each nullable. | `UpsertMyFlightPersonalDetailResponse { personalDetail }`. | Current user's participant must be a passenger on the flight. Strings trim; blank becomes null; `reservationNumber` max 80, `seat` max 20, `checkInUrl` nullable `http`/`https` URL max 500. |
| `PUT /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass` | Raw binary body; `Content-Type` `image/jpeg`, `image/png`, or `image/webp`; no JSON body. | `UploadMyFlightBoardingPassResponse { personalDetail }`. | Current passenger only. Size max 10 MiB; server reads max 10 MiB + 1 byte; validates declared and detected content type; errors: 413 `UPLOAD_TOO_LARGE`, 415 `UNSUPPORTED_BOARDING_PASS_MEDIA_TYPE`, 503 `BOARDING_PASS_STORAGE_UNAVAILABLE`. |
| `DELETE /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass` | No body. | 204 no content. | Current passenger only. No existing own attachment is a 204 no-op. |
| `POST /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass/open-url` | No body. | `OpenMyFlightBoardingPassResponse { url, expiresAt, contentType, byteSize }`. | Current passenger only, own attachment required. Repeated requests are allowed and return newly authorized short-lived URLs without mutating attachment metadata. |

Common errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 500 `INTERNAL_ERROR`, plus upload/storage-specific errors above.

## Privacy model

- Current trip participant can read shared flight rows and passenger display names.
- Current user's passenger participant row can read/write only its own personal detail.
- No role override exists in MVP: owner, creator, or leader cannot read another passenger's reservation number, seat, check-in URL, object metadata, or signed URL.
- Object keys and signed URLs are never returned from list/detail; signed URL is returned only by the explicit open endpoint for the owning passenger.
- Shared flight endpoints never embed another passenger's `flight_personal_details` row, not even redacted attachment metadata.
- Removing a passenger from the trip deletes their passenger membership and personal detail rows after cleanup jobs are enqueued. After removal, the user is no longer a trip participant and all flight endpoints return 403/404 according to existing trip access mapping.

## Signed URL security

- `POST /trips/{tripId}/flights/{flightId}/my-detail/boarding-pass/open-url` is the only signed URL source.
- The URL is scoped to one object key/generation and one HTTP GET operation.
- The default and maximum TTL is 5 minutes. The client must not persist the URL; list/detail responses never include it.
- If the passenger is removed after a URL is issued, the URL may remain usable until its short TTL expires; the system treats this as an unavoidable short-lived object-store artifact and relies on TTL plus cleanup job deletion. New open-url requests after removal must be denied.
- Signed URL responses should include cache-control guidance for clients (`no-store` in API response headers where practical), and mobile state must discard the URL after opening/failure.

## Attachment lifecycle

Upload/replace accepts one image. The server validates content type and size, stores bytes in private GCS, then persists object metadata. Replace/delete updates metadata and inserts deletion jobs for old objects in the same DB transaction. After commit the API attempts best-effort deletion and records job status; pending jobs remain durable for later retry/ops handling.

Required cleanup ordering:

1. Upload replace/delete reads the current object metadata with row-level locking.
2. The DB transaction updates/clears the current passenger's attachment metadata.
3. The same transaction inserts a `storage_object_deletion_jobs` row for the old object, if one existed.
4. After commit, the API attempts object deletion and marks the job `succeeded` or `failed` with attempts/error.
5. Repeating delete on the same missing attachment is idempotent and returns 204 without creating a duplicate job.

If a new object upload succeeds but the DB metadata update fails, the API must attempt to delete the newly uploaded object; if it cannot, it records an `orphaned_upload` cleanup job when a DB connection is still available and returns the original mutation error.

### Storage lifecycle matrix

| Event | Required DB state | Object expectation | API/mobile observable behavior |
|---|---|---|---|
| Replace boarding pass | Personal detail points to new object; cleanup job exists for old object. | Old object deleted immediately or by worker; new object remains. | Upload returns own updated personal detail. |
| Delete boarding pass | Personal detail attachment metadata is all null; cleanup job exists for old object. | Old object deleted immediately or by worker. | Delete returns 204; detail shows no attachment. |
| Participant removal | Passenger membership/personal detail rows removed after cleanup jobs are enqueued for their objects. | Objects deleted by worker if not already deleted. | Removed user cannot access trip/flight endpoints; remaining users do not see removed passenger. |
| Trip hard-delete | Flight rows cascade/delete after cleanup jobs are enqueued for all trip flight objects. | Objects deleted by worker if not already deleted. | Existing trip delete behavior remains; deleted trip is inaccessible. |
| Expired signed URL | No DB change. | Object may still exist if attachment not deleted. | Client must request a new open URL; old URL may fail after TTL. |
| Cleanup retry exhaustion | Job status is `failed`, object metadata no longer reachable from app if delete/replace committed. | Object may remain until operator remediation. | No passenger-visible access path; alert/log/runbook handles remediation. |

Cleanup operations and observability:

- Cleanup jobs are expected to reach `succeeded` within 24 hours under normal GCS availability.
- The worker retries failed jobs with bounded backoff and increments `attempts`; after 5 failed attempts it leaves the job `failed` with `lastError` for operational follow-up.
- Deletion failures are not shown to the passenger after metadata has been removed, because the private material is no longer reachable through the app; failures are logged with cleanup job id, reason, and status, but not signed URLs or raw object contents.
- Open-url issuance writes a structured security log with user id, trip id, flight id, passenger participant id, attachment metadata id/detail id, result, and expiry; MVP does not add a durable audit-log table.
- Logs must not include signed URLs, reservation numbers, seat values, check-in URLs, or image bytes. Object keys may appear only in cleanup-worker debug logs when needed for operations and should be avoided in normal info logs.

### Field visibility matrix

| Field/object | Visibility |
|---|---|
| Flight id, display title, flight number, departure/arrival airport/time fields, passenger participant ids/display names | Shared-trip-visible to current trip participants. |
| Current user's `myPersonalDetail.reservationNumber`, `seat`, `checkInUrl`, own `boardingPass.exists/contentType/byteSize/uploadedAt` | Passenger-private; returned only for the current user's passenger row. |
| Another passenger's reservation number, seat, check-in URL, boarding-pass metadata | Forbidden in every list/detail response and inaccessible by owner/creator/leader. |
| GCS bucket, object key, object generation | Server-internal; never returned to mobile. |
| Signed boarding-pass URL | Passenger-private ephemeral value; returned only by own open-url endpoint; forbidden in list/detail and logs. |
| Image bytes | Server/object-store only; never stored in DB or logs. |
- Metrics/logs must expose counts of pending/failed cleanup jobs. A failed job after 5 attempts emits an error log suitable for alerting.
- MVP has no admin UI. Operator recovery is DB/runbook based: inspect failed jobs, fix GCS/IAM/config, reset `status` to `pending` and `next_attempt_at` or run a one-shot cleanup command if added by implementation.

## Mobile privacy, offline, and concurrency rules

- Mobile must not persist signed URLs, object keys, reservation numbers, seats, check-in URLs, or selected image bytes in AsyncStorage/SecureStore or app-level disk caches.
- The app must not render boarding-pass images through a cache-backed in-app image component in MVP. It opens the short-lived signed URL and immediately discards it from React state after success/failure.
- OS/browser cache, screenshots, and user sharing outside the app are out of MVP control; the app should not add its own share action for boarding passes.
- Mobile logs, analytics, error messages, and crash breadcrumbs must redact reservation number, seat, check-in URL, signed URL, object key, and image URI.
- No offline mutation queue in MVP. Offline or network failures show retryable UI; the user must retry manually.
- Duplicate taps are disabled for create, personal-detail save, upload, delete, and open actions while the same action is in flight.
- Server row locking serializes upload/delete races for one personal detail. Last committed mutation wins; overwritten old objects are cleanup-jobged.
- Repeated delete is idempotent 204. Repeated open-url requests are allowed. Double upload may create more than one object, but only the last committed object remains referenced and superseded objects are cleanup-jobged.
- After any personal-detail mutation, mobile refreshes or locally patches the detail from the response and ignores stale earlier responses using a request token/current-flight guard.

## Today integration

A user's own flight is operational from `departureAt - 24h` until after the flight is no longer useful. MVP treats it as useful until `arrivalAt + 6h` to avoid stale cards while still covering arrival/check-in needs.

Today should show the flight card even if the trip date has not started yet but the user's flight is within the operational window. During an ongoing trip day, the flight card appears above existing itinerary content. The primary action is:

- `탑승권 열기` when own attachment exists;
- `탑승권 추가` when own attachment is missing.

Companion arrival summaries use shared flight route/time/passenger data only and compare same-day using flight arrival local date, not a device-time converted instant.

## API schema appendix

All JSON APIs use the existing `ErrorResponse` shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "validation error",
    "details": []
  }
}
```

### Shared schemas

```ts
type FlightEndpointInput = {
  airportText: string;      // trim 1..120
  airportCode: string | null; // trim, uppercase, 1..8 when present
  localDate: string;        // YYYY-MM-DD
  localTime: string;        // HH:mm 24-hour
  timeZone: string;         // valid IANA zone
};

type FlightEndpoint = FlightEndpointInput & {
  at: string;               // date-time UTC instant, server-derived
};

type FlightPassenger = {
  participantId: string;
  displayName: string;
};

type FlightBoardingPassSummary = {
  exists: boolean;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | null;
  byteSize: number | null;
  uploadedAt: string | null;
};

type MyFlightPersonalDetail = {
  reservationNumber: string | null;
  seat: string | null;
  checkInUrl: string | null;
  boardingPass: FlightBoardingPassSummary;
};

type FlightSummary = {
  id: string;
  displayTitle: string;
  flightNumber: string | null;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  passengers: FlightPassenger[];
  myPersonalDetail: MyFlightPersonalDetail | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type FlightDetail = FlightSummary;
```

### Endpoint request/response shapes

```ts
type ListTripFlightsResponse = { flights: FlightSummary[] };

type CreateTripFlightRequest = {
  displayTitle: string;          // trim 1..80
  flightNumber: string | null;   // trim, null if blank, max 20
  departure: FlightEndpointInput;
  arrival: FlightEndpointInput;
  passengerParticipantIds: string[]; // non-empty, distinct UUIDs in same trip
};
type CreateTripFlightResponse = { flight: FlightDetail };

type GetTripFlightResponse = { flight: FlightDetail };

type UpsertMyFlightPersonalDetailRequest = {
  reservationNumber: string | null; // trim, blank -> null, max 80
  seat: string | null;              // trim, blank -> null, max 20
  checkInUrl: string | null;        // trim, blank -> null, http/https, max 500
};
type UpsertMyFlightPersonalDetailResponse = { personalDetail: MyFlightPersonalDetail };

type UploadMyFlightBoardingPassResponse = { personalDetail: MyFlightPersonalDetail };

type OpenMyFlightBoardingPassResponse = {
  url: string;
  expiresAt: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
};
```

Success examples:

```json
{
  "flight": {
    "id": "flight_1",
    "displayTitle": "KE 017",
    "flightNumber": "KE017",
    "departure": {
      "airportText": "ICN",
      "airportCode": "ICN",
      "localDate": "2026-08-01",
      "localTime": "14:30",
      "timeZone": "Asia/Seoul",
      "at": "2026-08-01T05:30:00Z"
    },
    "arrival": {
      "airportText": "LAX",
      "airportCode": "LAX",
      "localDate": "2026-08-01",
      "localTime": "09:50",
      "timeZone": "America/Los_Angeles",
      "at": "2026-08-01T16:50:00Z"
    },
    "passengers": [{ "participantId": "participant_1", "displayName": "민수" }],
    "myPersonalDetail": null,
    "createdByUserId": "user_1",
    "createdAt": "2026-07-13T00:00:00Z",
    "updatedAt": "2026-07-13T00:00:00Z"
  }
}
```

Failure examples:

- Invalid time zone: HTTP 400 `VALIDATION_ERROR`, detail field `departure.timeZone` or `arrival.timeZone`.
- Upload too large: HTTP 413 `UPLOAD_TOO_LARGE`.
- Other passenger personal detail attempt: HTTP 403 `FORBIDDEN`.
- Existing flight missing in this trip: HTTP 404 `NOT_FOUND`.

## DB schema appendix

### `flights`

Required columns:

```sql
id uuid primary key default gen_random_uuid(),
trip_id uuid not null references trips(id) on delete cascade,
flight_number text null,
display_title text not null,
departure_airport_text text not null,
departure_airport_code text null,
departure_local_date date not null,
departure_local_time time not null,
departure_time_zone text not null,
departure_at timestamptz not null,
arrival_airport_text text not null,
arrival_airport_code text null,
arrival_local_date date not null,
arrival_local_time time not null,
arrival_time_zone text not null,
arrival_at timestamptz not null,
created_by_user_id uuid not null references users(id) on delete restrict,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (id, trip_id),
check (arrival_at > departure_at)
```

Required indexes/checks:

- `flights_trip_departure_idx on flights(trip_id, departure_at, id)`.
- `flights_trip_arrival_idx on flights(trip_id, arrival_at, id)`.
- Length checks: `display_title` 1..80 after trim, `flight_number` null or 1..20, airport text 1..120, airport code null or 1..8, time zones 1..80.

### `flight_passengers`

```sql
id uuid primary key default gen_random_uuid(),
flight_id uuid not null,
trip_id uuid not null,
participant_id uuid not null,
added_by_user_id uuid not null references users(id) on delete restrict,
created_at timestamptz not null default now(),
unique (flight_id, participant_id),
foreign key (flight_id, trip_id) references flights(id, trip_id) on delete cascade,
foreign key (participant_id, trip_id) references trip_participants(id, trip_id) on delete cascade
```

Required index: `flight_passengers_trip_participant_idx on flight_passengers(trip_id, participant_id, flight_id)`.

### `flight_personal_details`

```sql
id uuid primary key default gen_random_uuid(),
flight_id uuid not null,
trip_id uuid not null,
passenger_participant_id uuid not null,
created_by_user_id uuid not null references users(id) on delete restrict,
reservation_number text null,
seat text null,
check_in_url text null,
boarding_pass_bucket text null,
boarding_pass_object_key text null,
boarding_pass_generation text null,
boarding_pass_content_type text null,
boarding_pass_byte_size integer null,
boarding_pass_uploaded_at timestamptz null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (flight_id, passenger_participant_id),
foreign key (flight_id, passenger_participant_id) references flight_passengers(flight_id, participant_id) on delete cascade
```

Required checks:

- `reservation_number` null or 1..80 after trim.
- `seat` null or 1..20 after trim.
- `check_in_url` null or max 500; service enforces http/https URL.
- `boarding_pass_content_type` null or one of `image/jpeg`, `image/png`, `image/webp`.
- `boarding_pass_byte_size` null or between 1 and 10485760.
- Attachment metadata all-null/all-present check over bucket, object key, generation, content type, byte size, uploaded at.

### `storage_object_deletion_jobs`

```sql
id uuid primary key default gen_random_uuid(),
bucket text not null,
object_key text not null,
object_generation text null,
reason text not null,
status text not null default 'pending',
attempts integer not null default 0,
next_attempt_at timestamptz not null default now(),
last_error text null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
processed_at timestamptz null
```

Required checks/indexes:

- `reason in ('replace','delete','participant_removed','trip_deleted','orphaned_upload')`.
- `status in ('pending','running','succeeded','failed')`.
- `attempts >= 0`.
- Index pending work by `(status, next_attempt_at, id)` where status in `pending`, `failed` if retryable.
- Unique active cleanup key on `(bucket, object_key, coalesce(object_generation,''))` where status in `pending`, `running`.

Worker state transitions:

- `pending -> running -> succeeded` on successful GCS delete or object-not-found.
- `pending/running -> pending` with incremented attempts and future `next_attempt_at` on retryable failure below 5 attempts.
- `pending/running -> failed` on the 5th failed attempt.
- `failed -> pending` only by operator/runbook reset.

Row locking strategy:

- Upload/delete locks the current user's personal detail row with `FOR UPDATE` when present.
- If no personal detail exists yet, upload/upsert locks the matching `flight_passengers` row and inserts the personal detail.
- Cleanup worker claims jobs with `FOR UPDATE SKIP LOCKED`.

## Implementation-gating test cases

API/server must-pass cases:

1. Non-trip participant listing flights receives 403/404 according to existing trip access behavior.
2. Trip participant lists flights and sees shared passengers but not another passenger's personal detail.
3. Flight creator who is not passenger cannot call my-detail/upload/open-url for that flight.
4. Trip owner cannot read/open another passenger's detail or attachment.
5. Passenger can upsert own reservation fields; blank strings clear to null.
6. Invalid IANA zone and DST spring-forward gap return 400.
7. Date-line flight with arrival local date before departure local date succeeds when derived arrival instant is later.
8. Upload rejects 10 MiB + 1 byte with 413 and unsupported/mismatched MIME with 415.
9. Open-url returns a URL only for own existing attachment and never appears in list/detail responses.
10. Repeated delete returns 204 and does not create duplicate active cleanup jobs.
11. Double upload leaves one referenced object and enqueues cleanup for the superseded object.
12. Participant removal and trip deletion enqueue cleanup jobs for affected attachment objects before rows are deleted.
13. Cleanup worker treats object-not-found as success and marks failed after 5 retryable failures.

Mobile must-pass cases:

1. AppBar shows `항공권` action left of companions and keeps bottom tabs unchanged.
2. Vault renders loading, retryable error, empty CTA, and populated `내 항공편`/`동행 도착` sections.
3. Create form validates required local date/time/time-zone/passengers and disables duplicate save.
4. Detail non-passenger view shows shared data only and no personal form/actions.
5. Detail passenger view saves/clears reservation fields and patches state from response.
6. Attachment picker cancel is silent; permission denied and upload errors show retryable copy.
7. Replace/delete require confirmation and disable duplicate taps.
8. Open-url action discards URL after opening/failure and does not persist it.
9. Today hides the flight card when no operational flight exists and preserves existing itinerary Today content.
10. Today shows operational flight on an upcoming trip within 24 hours before departure.
11. Device timezone regression: LAX local time displays as LAX local time even when device timezone is Asia/Seoul.
12. Stale response guard: earlier upload/open/detail response cannot overwrite a later delete/replace state.

## Implementation Plan

Canonical detailed plan: `.harness/runs/F277-flight-ticket-vault/artifacts/implementation-plan.md`.

Tracked PR plan summary:

1. OpenAPI contract and generated artifacts for flight list/create/detail, my-detail, boarding-pass upload/delete/open-url.
2. DB migration/sqlc for `flights`, `flight_passengers`, `flight_personal_details`, `storage_object_deletion_jobs`, same-trip constraints, and cleanup-job indexes.
3. API flight service validation/authorization with airport-local time parsing, UTC instant derivation, passenger-only privacy, and personal-detail rules.
4. Object-store seam, GCS implementation, signed URL generation, cleanup worker, and redacted structured logs.
5. API handlers/server wiring for JSON endpoints and bounded raw image upload.
6. Existing trip deletion and participant removal cleanup-job compatibility.
7. Mobile flight helper/view-model layer for time display, vault grouping, detail privacy, attachment state, and Today operational window.
8. Mobile AppBar action and full-screen vault/create/detail screens.
9. Today integration for my operational flight and companion arrival context.
10. Full verification: generated checks, API tests/build, mobile tests/typecheck, lint/format, DB migration apply/rollback when `DATABASE_URL` is available, and manual smoke.

Implementation must be test-first where practical and must stop for re-triage if product/domain privacy scope changes.
