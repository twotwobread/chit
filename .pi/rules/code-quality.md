
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/code/code-quality.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Code Quality Rule

Use when a change risks duplication, oversized files, or layer confusion.

## General

- Do not refactor unrelated code.
- Extract only to remove current duplication or make changed behavior testable.
- Avoid option-heavy abstractions for future needs.
- Keep behavior changes separate from behavior-preserving refactors.

## Mobile

- Screen files should not own complex formatting, sorting, grouping, or state mapping.
- If the same UI/style pattern appears twice, check existing primitives.
- Do not copy the same pattern a third time; extract or reuse.
- If a screen exceeds ~450 lines, consider helper/component extraction tied to the current change.

## API

- Keep handler/service/repository responsibilities separate.
- Split domain handlers/mappers/errors when a file starts mixing unrelated domains.
- Keep repository interfaces narrow enough that fakes do not need unrelated methods.

## Review check

- New helper does not duplicate an existing one.
- Changed logic has test coverage or a recorded gap.
- Large-file growth has an explicit reason.
