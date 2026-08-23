---
schema_version: feature-spec.v1
id: "0459-outing-events-mvp"
title: "Outing event MVP"
status: approved
summary: "Expose lightweight non-trip outing event creation/detail backed by meetings without trip-only UI."
scope:
  in:
    - "Outing metadata in OpenAPI/DB/event domain"
    - "Saved-meeting participant subset selection for createEvent"
    - "Mobile /events/new and /events/{eventId} screens"
    - "Home and meeting detail routing to outings"
  out:
    - "Recurring events"
    - "Calendar sync"
    - "Trip tabs/planning for outings"
acceptance_criteria:
  - "User can create an outing from Home."
  - "Outing connects to one-off, new saved, or existing saved meeting context."
  - "Existing saved meeting outing supports participant selection."
  - "Outing detail has no trip-only Day/lodging/flight/tab UI."
api_changes:
  - "Extend CreateEventRequest/Event with startTime/placeName/placeAddress/category."
  - "Add EventCategory enum."
  - "Add participantMemberIds to CreateEventRequest."
db_changes:
  - "Add nullable outing metadata columns to events via migration 00035."
mobile_changes:
  - "Add outing create/detail helpers and screens."
  - "Update Home and meeting detail outing routes."
test_plan:
  - "API service/server/storage tests."
  - "Mobile helper/source tests."
  - "Full verification gates."
open_questions: []
provider:
  name: micro-spec-author
  evidence:
    - "Issue #459"
    - "Existing /events API and outing enum"
    - "Mobile trip creation and meeting detail seams"
---

Canonical details: `docs/features/0459-outing-events-mvp.md`.
