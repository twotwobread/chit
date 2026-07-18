# Feature Slice: F-328 상용 지도 앱형 장소 검색 화면

## Metadata

- GitHub Issue: #328
- Status: Approved for Implementation
- Created: 2026-07-18
- Source run: `.harness/runs/20260718-issue-328-map-search-ui`

## Goal

지도 기반 장소 검색을 상용 지도 앱에 가까운 구조로 개편한다.

사용자는 화면 진입 직후 safe-area 아래의 상단 검색창을 보고 바로 검색을 시작할 수 있다. 지도는 계속 보이고, 하단 sheet는 `검색 결과`와 `찜한 장소` 탭으로 목록 맥락을 분리한다. 검색 결과/찜 장소를 탭하거나 marker를 탭하면 같은 장소가 선택/highlight/focus 상태로 동기화된다.

기존 #229의 풍부한 장소 카드 정책과 #308의 명시적 검색 기준 정책은 유지한다.

## Commercial UI research snapshot

이 리서치는 구현 전 desk research로 정리한 상용 지도/여행 앱 패턴 비교다. 최종 pixel-perfect 디자인 확정이 아니라, 이음의 여행/일정 맥락에 적용할 구조적 패턴을 고르는 용도다.

| App | First-entry search | Result sheet / tabs | Marker-list sync | Saved access | Multi-place / trip pattern | Keep for i-um | Do not copy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Naver Map | 상단 검색창이 항상 강하게 노출되고 placeholder로 검색 시작점을 알려준다. | 검색 후 지도 위 결과와 하단/목록 전환이 공존한다. 저장/주변/필터 맥락은 별도 entry로 분리된다. | marker 또는 목록 선택 시 지도 focus와 목록 강조가 함께 움직인다. | 저장 장소는 별도 저장/리스트 entry가 명확하다. | 여러 장소 저장/리스트는 지도 탐색과 분리된 저장 플로우가 강하다. | 첫 진입 상단 검색창, marker/list sync, 명시적 저장 entry. | 국내 지도 provider/복잡한 카테고리·필터 UI. |
| Kakao Map | 상단 검색창과 빠른 카테고리/주변 탐색이 첫 화면에 노출된다. | 결과 목록이 sheet처럼 지도 위에 올라오고 선택 결과가 지도와 연결된다. | 선택 결과 중심 이동과 pin 강조가 자연스럽다. | 즐겨찾기/저장 목록은 별도 저장 화면 성격이 강하다. | 목적지/경유지 같은 route 중심 다중 선택은 별도 길찾기 흐름이다. | 검색 시작점의 즉시성, 목록-지도 연결. | 주변 카테고리/길찾기 중심의 복잡한 탭. |
| Google Maps | 상단 rounded search bar가 지도 위 고정 entry 역할을 한다. | 결과는 하단 sheet/card로 표시되고 snap/scroll이 지도와 함께 동작한다. | marker/list/card selection이 지도 camera와 연결된다. | Saved는 메인 탭/장소 detail save action으로 접근한다. | 여행 리스트 저장은 별도 list/save 흐름이다. | `상단 검색창 + 지도 + 하단 sheet` 기본 구조, selection sync. | 전역 Saved 탭 구조나 ranking/pagination. |
| Apple Maps | 검색은 bottom card 안에서 시작하는 비중이 크지만, 지도와 sheet 조합이 명확하다. | sheet snap state와 keyboard가 자연스럽게 연동된다. | place card와 map focus가 강하게 연결된다. | Guides/Library로 저장 장소에 접근한다. | Guides에 장소를 저장하는 흐름은 여행 큐레이션과 유사하다. | sheet snap/keyboard 안정성, card 중심 detail. | 첫 진입 검색창을 bottom card 안에만 두는 구조. |
| Triple / travel itinerary apps | 여행/도시 맥락의 장소 검색과 저장/일정 담기가 분리되어 있다. | 저장한 장소와 일정 후보를 목록으로 탐색한다. | 지도보다는 itinerary/list 맥락이 강하다. | 찜/저장 목록 접근이 여행 단위로 묶인다. | 다중 장소 추가/장바구니 패턴이 있으나 이번 이슈는 제외다. | 현재 여행의 `찜한 장소` 탭을 sheet 안에 직접 제공. | multi-select/cart 일정 담기. |

### Research decisions

- 가져올 패턴
  - 첫 진입부터 safe-area 아래 상단 검색창을 항상 보여준다.
  - 검색창 focus/submit은 sheet를 검색 모드로 올리되 지도를 유지한다.
  - 하단 sheet는 목록 맥락을 탭으로 분리한다: `검색 결과`, `찜한 장소`.
  - marker tap과 list item tap은 동일한 selected/highlight state를 사용한다.
  - 저장/찜 목록은 전역 저장 탭이 아니라 현재 여행의 장소 탐색 맥락 안에서 바로 접근한다.
- 가져오지 않을 패턴
  - 자동 pan-search, 무한 스크롤, provider 전환, 복잡한 주변 카테고리 필터.
  - Apple Maps처럼 첫 검색창을 bottom card 안에만 두는 구조.
  - Triple류의 다중 선택/cart 저장.

## Scope

### In

- `GooglePlaceMapSearch`의 지도 overlay 상단 검색창.
- Safe-area와 sheet top inset이 겹치지 않는 layout.
- Bottom sheet 탭: `검색 결과`, `찜한 장소`.
- `찜한 장소` 탭에서 현재 여행의 `bookmarkResults` 전체 목록 탐색.
- Search result list, bookmark list, marker tap selection/highlight/focus sync.
- Existing place card richness: photo/category/rating/review count/opening status/selected-only description lazy load.
- Existing #308 behaviors: search basis label, trip destination chips, explicit `이 지역에서 다시 검색`, selected-place `이 위치 근처 검색`.
- Existing action modes: day itinerary add, lodging register/select, map-tab bookmark/delete/explore actions.
- Mobile helper tests and source-guard tests for layout/tabs/selection seams.

### Out

- Multi-select/cart schedule add.
- Map provider switching or Naver/Google provider policy changes.
- Search ranking changes, pagination/infinite scroll, auto-search on map pan.
- Review body/summary/gallery additions.
- API contract, server, generated client, DB schema, or migration changes.

## Requirements

- First entry renders an always-visible top search bar overlay below the safe-area.
- The top search bar uses the current query state and can run the same search path as the existing sheet search row.
- Focusing or typing in the search bar expands the sheet to search/list mode while keeping the map visible.
- The bottom sheet always keeps a handle/minimized affordance visible.
- In expanded/full sheet states, tabs appear above list content.
- `검색 결과` tab shows existing search states and rich result cards.
- `찜한 장소` tab shows the current trip bookmark list from `bookmarkResults`, not only the currently selected bookmark detail.
- Empty bookmark state is explicit and friendly.
- Tapping a search result selects/highlights it, preserves existing detail lazy-load behavior, and focuses the map.
- Tapping a bookmark list item selects/highlights it, uses the bookmark marker variant, focuses the map, and shows the same rich card actions allowed by the current action mode.
- Tapping a marker selects the corresponding search/bookmark item, expands the sheet, and scrolls/focuses the selected tab list item.
- Closing search results must not make bookmarked places inaccessible; the bookmark tab remains usable.
- Existing destination chip and search-basis labels stay visible in search context.
- Region search remains explicit only; map pan does not trigger search.

## Implementation notes

- Prefer helper functions in `apps/mobile/lib/places/google-search.ts` for tab state, first-entry layout visibility, and selected list source decisions.
- Keep `GooglePlaceMapSearch.tsx` as the orchestration/composition layer: map events, sheet state, text input state, and card rendering.
- Use existing theme tokens. Do not add raw colors.
- Reuse `PlaceResultCard` for both search results and bookmarks to preserve #229 behavior.
- Keep selected detail state shared by result id. When switching selected source between search/bookmark, clear or update messages that are tied to the previous source.
- Use separate layout refs for result cards and bookmark cards so marker tap can scroll the active tab to the matching item.
- Keep bottom-sheet native dynamic sizing disabled.

## Acceptance Criteria

- [ ] AC-01: 구현 전 상용 지도/여행 앱 UI 리서치 결과가 이 feature spec에 남아 있다.
- [ ] AC-02: 장소 검색 화면 첫 진입 시 상단 검색창이 항상 보인다.
- [ ] AC-03: 검색창은 safe area와 겹치지 않고 지도 위 overlay로 동작한다.
- [ ] AC-04: bottom sheet는 `검색 결과`와 `찜한 장소` 탭을 제공한다.
- [ ] AC-05: `찜한 장소` 탭에서 현재 여행의 찜 목록을 list로 탐색할 수 있다.
- [ ] AC-06: 찜 목록 item tap과 marker tap은 서로 selection/highlight/focus가 동기화된다.
- [ ] AC-07: 검색 결과 tab은 기존 사진/카테고리/평점/리뷰 수/영업 상태/description lazy-load 정책을 유지한다.
- [ ] AC-08: 검색 기준 label, 여행 도시 chip, `이 지역에서 다시 검색`, `이 위치 근처 검색` 동작은 유지된다.
- [ ] AC-09: sheet snap/scroll/keyboard 동작이 iOS/Android에서 검색창, 탭, 목록 스크롤과 충돌하지 않는다.
- [ ] AC-10: 기존 일정 추가/숙소 등록/지도 탭 찜하기 action mode가 새 UI에서도 동작한다.

## Test Plan

- Helper tests in `apps/mobile/lib/places/google-search.test.mts`:
  - first-entry layout state exposes top search bar visibility;
  - tab selection defaults and switches between search/bookmark contexts;
  - bookmark list item/marker selection resolves the correct tab/source;
  - existing sheet snap and explicit region-search behavior remains unchanged.
- Source-guard tests in `apps/mobile/lib/app-info/google-place-search-entry.test.mts`:
  - top search overlay is rendered outside minimized sheet content;
  - bottom sheet tab labels exist;
  - existing optional native bottom-sheet guards remain.
- Verification commands:
  - `pnpm --filter @i-um/mobile test -- google-search`
  - `pnpm --filter @i-um/mobile test -- google-place-search-entry`
  - `pnpm --filter @i-um/mobile typecheck`
- Manual smoke gap if device access is unavailable:
  - iOS/Android sheet gesture, keyboard, map pan, marker tap, bookmark tab scroll, day add/lodging/bookmark modes.
