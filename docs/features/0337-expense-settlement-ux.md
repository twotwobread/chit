# Feature Slice: F-337 지출/정산 IA 분리와 최신 정산 요청 상세

## Metadata

- GitHub Issue: #337
- Status: Planned
- Created: 2026-07-19
- Updated: 2026-07-19
- Run: `.harness/runs/20260719-issue-337-expense-settlement-ux`
- Provider evidence: user-approved brainstorming + visual companion session `.superpowers/brainstorm/23626-1784445156`

## Goal

돈 관련 화면의 목적을 명확히 분리한다.

- `지출`: 무엇을 썼고 어떻게 기록/분류되었는지 관리한다.
- `정산`: 그래서 누가 누구에게 얼마를 보내야 하는지 계산 근거와 요청을 보여준다.

정산 요청을 받은 참여자는 공유/deep link를 통해 앱 안에서 최신 정산 계산 상세를 확인할 수 있어야 한다.

## Product Decisions

- Trip bottom tab을 `오늘 / 지도 / 일정 / 지출 / 정산` 5개로 구성한다.
- 현재 `정산` 탭에 섞여 있는 지출 관리 정보는 새 `지출` 탭으로 이동한다.
- `오늘`의 빠른 지출은 현장에서 빠르게 기록하는 흐름으로 유지한다.
- `지출` 페이지는 전체 지출 관리와 상세 등록 흐름을 담당한다.
- `지출 추가` 첫 화면은 `직접 입력`을 primary로, `영수증으로 채우기`를 secondary로 제공한다.
- 영수증/OCR draft 기능은 선택형 자동 채우기로 유지하며, OCR 값은 저장 전 확인이 필요한 초안으로 표시한다.
- 상세 지출 등록 폼은 긴 입력 폼이 아니라 초안 요약 + 확인 그룹 + 항목별 수정 구조로 단순화한다.
- 상세 지출 등록 본문은 중복되는 상단 제목/설명을 줄이고, 하나의 큰 outer card 안에 작은 card를 넣지 않는다. 배경 위에 초안/확인 그룹 card를 직접 배치한다.
- `지출` 페이지는 총 지출, 카테고리별 사용 금액, 일자별 보기, 카테고리별 필터 보기를 제공한다.
- `정산` 탭은 사람별 결제/부담/net, 최종 송금 제안, 정산 요청 CTA에 집중한다.
- 정산 요청 링크는 요청 당시 snapshot이 아니라 현재 여행 지출 기준 최신 정산을 보여준다.
- 정산 요청 상세는 현재 여행 참여자만 볼 수 있다.

## Scope

### In

- Mobile trip tabs에 `지출` root tab 추가.
- Trip route helpers/fallback/tab active state에 `expenses` tab 반영.
- Expense tab main screen:
  - 통화별 총 지출.
  - 정산 포함/제외 요약.
  - 카테고리별 사용 금액 요약.
  - 최근 지출 목록.
  - 지출 추가 action.
- Expense tab `일자별 보기`:
  - `Day 1`, `Day 2`, ... 탭.
  - 일정에 연결되지 않은 지출을 위한 `여행 전체` bucket.
  - 선택한 Day/bucket의 지출 목록.
- Expense tab `카테고리별 사용 > 전체 보기`:
  - 카테고리 탭/칩.
  - 선택한 카테고리 합계/건수/비율.
  - 선택한 카테고리의 지출 목록.
- Expense add flow:
  - Direct-input-primary choice screen.
  - Optional receipt/OCR auto-fill.
  - OCR draft applied state and verification copy.
  - Draft summary and grouped review/edit sections instead of one flat form stack.
- Settlement tab cleanup:
  - 기본 지출 history/FAB/category summary 제거.
  - 최신 계산 안내, 사람별 결제/부담/net, 송금 제안, 정산 요청 CTA 유지.
- Latest settlement detail route:
  - Canonical route: `/trips/{tripId}/settlement-detail`.
  - `GET /trips/{tripId}/settlement` + `GET /trips/{tripId}/expenses`를 조합해 최신 계산 근거 표시.
  - 포함/제외 지출 구분.
  - 다중 통화 분리 표시.
- Settlement request share/deep link copy update.
- OpenAPI description update so `GET /trips/{tripId}/settlement` clearly documents current/latest participant-only calculation.

### Out

- Settlement request record/table.
- Request-time snapshot 저장.
- 정산 실행/송금 완료/결제 확인.
- 은행 계좌/간편결제 연동.
- 법적 정산서/PDF.
- 지출 댓글/분쟁 처리.
- 새로운 카테고리 taxonomy.

## UX Requirements

### Trip tabs

Bottom tab labels:

```text
오늘 / 지도 / 일정 / 지출 / 정산
```

- 각 tab은 label과 vector icon을 가진다.
- 현재 위치는 색상/강조 스타일로 명확히 표시한다.
- 5개를 초과하지 않는다.

### Expense main

Expense main은 상단부터 다음 순서로 보여준다.

1. 총 지출 카드.
2. 카테고리별 사용 카드.
3. 최근 지출 목록.

카테고리별 사용 카드는 pie/donut 대신 stacked bar + 텍스트 row를 사용한다.

각 category row는 다음 정보를 포함한다.

- 카테고리명.
- 금액.
- 건수.
- 전체 대비 비율.

색상만으로 카테고리를 구분하지 않는다.

### Day-based expense browsing

`일자별 보기`를 누르면 Day tab 기반 화면으로 이동한다.

- `Day 1`, `Day 2`, ...
- `여행 전체` bucket.
- 선택한 탭의 총액/건수/정산 포함·제외 요약.
- 선택한 탭의 지출 row 목록.

### Category-based expense browsing

`카테고리별 사용 > 전체 보기`를 누르면 카테고리 기반 화면으로 이동한다.

- 기존 expense category 탭/칩을 사용한다.
- 선택한 카테고리 합계, 건수, 전체 대비 비율을 표시한다.
- 선택한 카테고리 지출만 목록에 표시한다.
- 목록 row에는 Day/bucket, payer, split, includeInSettlement 상태를 확인할 수 있어야 한다.

### Expense add

첫 화면은 두 선택지를 보여준다.

1. `직접 입력` — primary.
2. `영수증으로 채우기` — secondary.

영수증은 필수가 아니다. OCR draft 적용 후에는 작은 상태 카드로 표시한다.

예시 copy:

```text
영수증 초안 적용됨 · 신뢰도 보통
금액/날짜/지출명을 확인한 뒤 저장해주세요.
```

상세 등록 화면은 초안 리뷰 구조로 보여준다.

- 상단: 지출 초안 요약(지출명/연결 일정, 금액, 결제일자, 결제자, 영수증 초안 여부).
- `먼저 확인`: 지출명, 결제일자, 금액.
- `정산`: 결제/분할 방식과 대상, 정산 포함 여부.
- `분류/연결`: 관련 일정 row, 카테고리/통화 2-column picker row.
- `선택 정보`: 메모, 영수증 다시 촬영/초안 해제.
- 저장 CTA.

복잡한 선택은 항목 row 또는 bottom sheet로 수정한다. 관련 일정 row를 누르면 Day 선택과 해당 Day의 일정 목록을 함께 보여주는 sheet가 열린다. 카테고리와 통화는 같은 row의 두 picker cell로 보여주고, 각각 누르면 선택 목록 sheet가 열린다.

### Settlement tab

Settlement tab은 다음에 집중한다.

- 최신/current 계산 안내.
- 통화별 정산 section.
- 사람별 결제/부담/net.
- 설명 copy: `결제 금액 - 부담 금액 = 받을/보낼 금액`.
- 최종 송금 제안.
- 정산 요청 CTA.

기본 화면에서 지출 history, category spend, 지출 등록 FAB를 보여주지 않는다.

### Settlement request detail

정산 요청 공유 링크는 `/trips/{tripId}/settlement-detail`로 연결한다.

상세 화면은 다음을 표시한다.

- 현재 여행 지출 기준 최신 정산이라는 안내.
- 통화별 총 결제액/총 부담액.
- 사람별 결제/부담/받을 금액/보낼 금액.
- 최종 송금 제안.
- 정산 포함 지출 목록.
- 정산 제외/현장 정산 완료 지출 목록 또는 badge.
- 각 지출 row의 payer, split 대상/금액, category, currency, includeInSettlement 상태.

비로그인 사용자는 로그인 안내를 본다. 비참여자 또는 접근 권한이 없는 사용자는 상세 내용 없이 권한/접근 불가 안내를 본다.

## API / Contract

### Policy

- No settlement request snapshot.
- No settlement request DB record.
- Latest/current APIs are authoritative.

### Existing APIs used by mobile detail

- `GET /trips/{tripId}/settlement`
- `GET /trips/{tripId}/expenses`

Both must remain authenticated and current-participant-only.

### Contract update

Update the OpenAPI description for `GET /trips/{tripId}/settlement` to clarify:

- It returns the current/latest settlement calculation.
- It is for authenticated current trip participants.
- It is not a historical request snapshot.

No response schema change is required unless implementation discovers a missing field that cannot be derived from existing settlement + expenses responses.

## DB Changes

No DB changes.

## Acceptance Criteria

- [ ] AC-01: Trip bottom navigation exposes `오늘 / 지도 / 일정 / 지출 / 정산`.
- [ ] AC-02: `지출` 탭 shows total spend, included/excluded summary, category spend summary, recent expenses, and an add action.
- [ ] AC-03: Category summary shows category label, amount, count, and percentage without relying on color alone.
- [ ] AC-04: `일자별 보기` shows Day N tabs and per-day expense lists, including `여행 전체` for unanchored expenses.
- [ ] AC-05: `카테고리별 사용 > 전체 보기` filters expenses by selected category.
- [ ] AC-06: `지출 추가` choice screen visually prioritizes `직접 입력` over optional `영수증으로 채우기`.
- [ ] AC-07: OCR draft can fill available fields and is clearly labeled as an optional draft requiring verification before save.
- [ ] AC-08: Detailed expense form shows a draft summary and grouped review/edit sections as direct screen cards instead of one nested outer-card form stack.
- [ ] AC-09: Today quick expense remains lightweight and does not inherit heavier Expense tab controls.
- [ ] AC-10: Settlement tab no longer default-renders expense management content or expense add FAB.
- [ ] AC-11: Settlement tab shows latest/current calculation copy.
- [ ] AC-12: Settlement request shared text includes a deep/app link to `/trips/{tripId}/settlement-detail`.
- [ ] AC-13: Settlement detail shows currency-level total paid and total share.
- [ ] AC-14: Settlement detail shows person-level paid/share/net and formula explanation.
- [ ] AC-15: Suggested transfer rows are traceable to the person-level net amounts.
- [ ] AC-16: Included and excluded expenses are visually distinct in settlement detail.
- [ ] AC-17: Each settlement detail expense row shows payer, split participants/amounts, category, currency, and includeInSettlement state.
- [ ] AC-18: Logged-out users opening the link see login guidance.
- [ ] AC-19: Non-participants cannot see settlement or expense details through the link.
- [ ] AC-20: Multi-currency settlement detail is grouped by currency with no exchange-rate conversion.

## Test Plan

| Behavior | Layer | Command |
|---|---|---|
| Expense tab route/tab helper includes `expenses` | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Category summary groups by category/currency and computes amount/count/percentage | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Day N browsing groups expenses by Day and `여행 전체` | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Category browsing filters expense rows by selected category | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Expense add choice/draft view model keeps direct input primary and receipt/OCR optional with draft verification copy | Mobile helper/component seam | `pnpm --filter @i-um/mobile test` |
| Settlement tab view model excludes expense management content by default | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Settlement detail view model renders totals, balances, transfers, formula, included/excluded expenses, multi-currency sections | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Settlement share message includes latest detail link and latest/current copy | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Participant authorization for settlement/expenses endpoints is preserved or covered | API tests / coverage confirmation | `pnpm --filter @i-um/api test` |
| OpenAPI description/generated artifacts remain consistent | Contract/generated | `pnpm verify:generated` when contract output changes |
| Context-bound mobile primitives remain safe after moving UI | Mobile guard | `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .` |
| Mobile screens compile | Mobile typecheck | `pnpm --filter @i-um/mobile typecheck` |

## Open Questions

None.

## Follow-up Issues

- Settlement request snapshot/history/audit if the product later needs immutable request records.
- Payment completion or transfer tracking.
- Expense disputes/comments.
- Budget limits or richer spending analytics beyond category summary.
