# Feature Slice: Chit Ledger × Memory 브랜드/디자인 시스템

## Metadata

- GitHub Issue: not yet assigned
- Status: Approved for design source of truth
- Created: 2026-07-19
- Updated: 2026-08-22
- Source: user-approved Chit redesign discussion and Ledger × Memory mockup review
- Scope type: Brand/design documentation first; implementation follows in separate slices

## Goal

Chit을 단순 여행 정산 앱이 아니라 **함께 쓴 돈과 함께한 시간을 한곳에 기록하는 그룹 라이프로그**로 정의한다.

브랜드 중심 문장:

```text
기록은 정확하게, 기억은 다정하게.
```

## Brand Decision

- 공식 브랜드명: `chit.` 또는 문맥상 `칫 Chit`.
- 앱 내 짧은 표기: `chit.` wordmark 또는 `칫`.
- 앱 아이콘/스플래시/헤더 기본 방향: clean wordmark 또는 clean symbol. Receipt stamp를 앱 아이콘 기본형으로 쓰지 않는다.
- Receipt, ticket, stamp 모티프는 completion/share/report/invite/memory 같은 시그니처 순간에만 제한적으로 사용한다.

## Positioning

Chit은 모임의 일정, 공동 장부, 정산, 지난 기록을 연결하는 `group life ledger`다.

- Functional value: 모임 일정 관리, 공동 지출 기록, 정산 근거와 송금 제안.
- Emotional value: 지난 여행과 약속이 그룹의 기록으로 남는다.
- Product promise: 돈은 명확하게, 기억은 따뜻하게.
- Design ratio: 정확함 50% + 따뜻함 35% + 위트 15%.

## Design Concept: Ledger × Memory

한 화면에서 금융과 추억을 어설프게 섞지 않는다. 같은 브랜드 안에 두 가지 모드를 둔다.

| Area | Impression | Design mode |
|---|---|---|
| 지출·정산 | 정확함, 신뢰, 명확함 | Paper White, 정렬된 숫자, 명확한 상태색 |
| 여행·모임 기록 | 따뜻함, 관계, 추억 | Receipt Cream, 사진, 티켓/스티커 요소 |
| 모임 | 지속성, 소속감 | 그룹별 컬러, clean icon, 멤버 아바타 |

돈을 다룰 때는 장부처럼 명확하고, 지난 기록을 볼 때는 사진첩처럼 따뜻해야 한다.

## Color System

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Brand | Chit Coral | `#FF6258` | 로고 dot, 선택 상태, 브랜드 포인트 |
| Action | Action Coral | `#C9433B` | 주요 버튼, 접근성이 필요한 핵심 액션 |
| Memory bg | Receipt Cream | `#FFF8ED` | 홈, 모임, 여행/약속 기록, 기억 화면 |
| Ledger bg | Paper White | `#FFFFFF` | 지출 입력, 정산 상세, 계산 영역 |
| Text/core | Ledger Ink | `#22242A` | 제목, 금액, 핵심 정보, dark summary |
| Neutral | Soft Gray | `#F2F3F5` | 구분선, 비활성 영역, subtle controls |
| Success | Clear Green | `#168A5B` | 정산 완료, 송금 완료, 받을 돈 positive state |
| Danger | Alert Red | `#D83A45` | 미납, 오류, 삭제, 위험 액션 |
| Info | Info Blue | `#3478D4` | 안내, 외부 링크, 환율/정보 |
| Accent | Ticket Yellow | `#FFC845` | 티켓/기록 보조 포인트, warm accent |

### Color Rules

- 코랄로 금융 상태를 표현하지 않는다. Chit Coral은 brand/action/selection 담당이다.
- 완료는 Clear Green, 오류·미납·삭제는 Alert Red, 정보와 외부 링크는 Info Blue를 사용한다.
- 지출/정산 화면의 기본 surface는 Paper White다.
- 모임/기록/홈의 기본 atmosphere는 Receipt Cream이다.
- Ledger Ink는 금액과 제목의 신뢰감을 담당한다.
- Ticket Yellow와 receipt/ticket motif는 장식 포인트이며 반복 UI의 주색이 아니다.
- Raw hex는 `apps/mobile/lib/design/theme.ts` 같은 token source에만 둔다.

## Logo and Motifs

### Logo

- Primary mark: clean `chit.` wordmark with Coral dot.
- Korean mark: `칫`은 앱 내 짧은 문맥, icon experiment, legal/한국어 설명에서 사용 가능.
- App icon: clean wordmark/symbol direction. Heavy stamp icon은 사용하지 않는다.

### Receipt / Stamp Motif

잘 어울리는 위치:

- 정산 완료 화면.
- 공유용 정산 이미지.
- 월별/여행별 리포트.
- 초대 링크/티켓 카드.
- `기록으로 남겼어요` 완료 상태.

금지/주의:

- 모든 카드와 버튼을 영수증처럼 만들지 않는다.
- 반복 list row, bottom tab, routine form에는 stamp를 쓰지 않는다.
- stamp는 앱의 기본 아이콘이 아니라 “기록됐다/정산됐다”는 시그니처 순간의 보조 모티프다.

## Typography

- 기본 서체는 Pretendard 계열을 유지한다.
- 일반 텍스트는 부드럽고 편안하게 읽힌다.
- 금액은 굵고 크게, tabular numbers를 사용한다.
- 손글씨나 장식 서체는 여행 제목, 스티커, 공유 이미지 등 제한된 memory moment에서만 고려한다.

정산 화면의 핵심 정보는 한 문장과 하나의 숫자로 이해되어야 한다.

```text
이번 여행에서 수영님이 받을 금액
+128,400원
```

## Information Architecture Direction

Root는 현재 앱의 2-depth 구조를 유지한다.

```text
Root: 홈 / 마이
↓
모임 상세: 일반 상세 페이지, 하단 nav 전환 없음
↓
Event Shell: 여행/데이트/약속에 진입했을 때만 작업 탭 전환
```

모임 상세는 다음을 보여준다.

- 다음 여행이나 모임.
- 현재 진행 중인 정산.
- 최근 기록.
- 함께한 횟수, 방문한 도시, 총 여행일 같은 group stats.
- 멤버와 초대/설정.

Event Shell은 event type에 따라 탭을 조정한다.

- 여행: 오늘 / 일정 / 지도 / 장부 / 정산.
- 데이트·약속: 일정 또는 오늘 / 장소 / 장부 / 정산 등 더 가벼운 구조.

## Settlement UX Principles

정산에서는 귀여움보다 설명 가능성이 우선이다.

각 지출 카드에는 다음이 드러나야 한다.

- 누가 결제했는지.
- 총금액.
- 누가 참여했는지.
- 어떻게 나눴는지.
- 수정된 적이 있는지.

최종 정산은 결과만 보여주지 않고 계산 근거를 확인할 수 있어야 한다.

```text
민수가 수영에게 42,000원을 보내요
식사 31,000원 + 택시 11,000원
```

정산 상태는 명확하게 분리한다.

- 입력 중.
- 정산 준비 완료.
- 정산 요청됨.
- 일부 송금 완료.
- 모두 정산 완료.

지출 수정 이력은 공동 비용 신뢰에 영향을 주므로 후속 기능에서 audit/log UX를 고려한다.

## Component Language

- `ScreenBackground`: Receipt Cream 기본.
- `Card`: Paper White ledger surface 기본.
- `MemoryCard`: Receipt Cream 또는 photo/ticket accent surface.
- `LedgerSummaryCard`: Paper White 또는 Ledger Ink surface with tabular money.
- `PrimaryButton`: Action Coral + Paper White text.
- `SecondaryButton`: Paper White/Soft Gray + Ledger Ink.
- `Badge/Pill`: state-specific semantic color.
- `TabButton`: selected Coral signal, not large decorative fill.
- `AmountText`: tabular, high contrast, green/red for credit/debit when semantic.
- Product iconography: vector/custom rounded icon set. Product UI에서 emoji를 structural icon으로 쓰지 않는다.

## Copy Voice

- Korean first.
- 짧고 다정하지만 계산은 단호하게.
- 실패/오류에서는 장난치지 않고 복구 방법을 먼저 말한다.

Examples:

```text
기록은 정확하게, 기억은 다정하게.
정산할 돈만 딱 확인해요.
이 기록은 모임에 남아요.
계산 근거를 볼 수 있어요.
정산을 불러올 수 없어요. 잠시 후 다시 시도해주세요.
```

## Accessibility and Quality

- Money surfaces require high contrast.
- Color is not the only state indicator.
- Touch targets stay at least 44pt.
- Reduced motion should be respected.
- Motion should explain completion or state transition, not decorate randomly.
- iOS and Android should remain visually and interactively equivalent.

## Implementation Source Mapping

| Area | Source / target |
|---|---|
| Brand/design spec | `docs/features/0341-chit-brand-design-system.md` |
| Mobile tokens | `apps/mobile/lib/design/theme.ts` |
| Shared components | `apps/mobile/lib/design/components.tsx`, `apps/mobile/lib/design/primitives.tsx` |
| Mobile UI rule | `.harness/rules/code/mobile-ui.md` |
| Brand assets | `apps/mobile/assets/brand/` |
| Expo app metadata | `apps/mobile/app.json`, `apps/mobile/app.config.ts` |

## Out of Scope for This Foundation Slice

- API/DB changes.
- Meeting/event data model migration.
- Final app icon production export.
- Full screen-by-screen redesign completion.

## Follow-up Implementation Order

1. Replace design-system foundation.
2. Apply to current screens.
3. Move features to meeting/event IA while refining UI.
4. Polish expense/settlement, meeting UI, interaction reactions, motion, and component details.
