# DEC-0001: MVP product scope

## Status

Accepted

## Context

i-um starts as a shared trip execution app, not a booking, search, navigation, or commerce product.

The product should help people execute an already planned trip with companions and settle shared expenses.

## Decision

MVP focuses on:

- authenticated mobile users and profiles
- trip create/list/detail/update/delete
- date-range based Day itinerary
- place add/edit/delete/reorder using trip-scoped place snapshots
- today execution surfaces for next and remaining places
- external map handoff and address copy
- participant list and invite flow
- quick expense entry and shared settlement result

## Out of Scope

Unless an explicit feature spec says otherwise, MVP excludes:

- in-app map/navigation/transit engine
- realtime collaboration cursors, comments, voting, full change timelines
- AI itinerary generation or recommendation
- booking, flight, lodging, activity commerce, or direct reservation API integration
- OCR, email/SMS/calendar import
- card/bank integration
- money transfer or payment confirmation flow
- complex roles, read-only participants, organization features
- admin page
- web app

## Consequences

- Feature specs should slice work inside this scope unless the user explicitly changes product direction.
- Out-of-scope work needs its own feature decision/spec before implementation.
- A target feature spec is more specific than this general MVP decision.
- Current code, OpenAPI, and migrations remain the implementation source of truth.

## Source of truth links

- Feature specs: `docs/features/`
- API contract: `packages/api-contract/openapi.yaml`
- DB schema: `apps/api/migrations/`, `apps/api/schema.sql`

## Supersedes / Superseded by

- None
