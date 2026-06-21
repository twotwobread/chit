# 모바일 UI 레퍼런스

임시 UI kit의 화면 정보를 Expo 앱 구현에 맞게 정리한 문서입니다. 실제 구현은 `apps/mobile/lib/design/theme.ts` 토큰과 React Native 컴포넌트를 사용합니다.

## 공통 구조

- 단일 컬럼, portrait mobile 기준
- 상단: 여행명, 날짜, 참여자 요약, 초대 액션
- 하단: `오늘`, `지도`, `일정`, `정산` 탭
- 우하단: amber 빠른 지출 FAB
- 화면 padding: 좌우 20px
- card 간격: 12–14px

## 오늘

목적: 길 위에서 바로 다음 행동을 할 수 있게 합니다.

구성:

1. Day 진행 상태 badge
2. 다음 장소 hero card
   - overline: `NEXT · 다음 장소`
   - 장소 타입 번호 dot
   - 장소명, 이전 장소에서의 이동 시간, 영업/시간 힌트
   - 주요 action: `길찾기`, `도착`
   - 보조 action: `스킵`, `숙소로`
3. 오늘 지출 요약 card
   - 총 지출
   - 내가 낸 금액
   - 확인 필요 badge
   - `지출 추가`
4. 남은 장소 list

## 지도

목적: 오늘 동선과 다음 장소 위치를 빠르게 확인합니다.

구성:

- 장소 타입별 번호 pin
- 완료 구간은 primary green, 남은 구간은 muted route
- 다음 장소 pin은 강조 ring
- 하단 floating card에서 다음 장소와 `길찾기` 제공

## 일정

목적: Day별 장소 순서와 이동 흐름을 편집합니다.

구성:

- Day 선택 chip row
- Day 요약 card: 장소 수, 예상 동선 시간
- 순서형 장소 list
  - 장소 번호 dot
  - 완료 장소는 약하게 처리
  - 다음 장소 badge
  - 누가 추가했는지 표시
  - 다음 장소까지 이동 시간 표시
- `장소 추가` action

## 정산

목적: 최종 송금 결과를 먼저 보여주고 상세 내역은 뒤에 둡니다.

구성:

1. 여행 전체 정산 card
   - 총 지출
   - 참여자 수
2. 최종 송금 list
   - `A → B`
   - 송금 금액은 debit 색상
3. 사람별 정산 list
   - 낸 금액 / 부담 금액
   - net이 양수면 credit, 음수면 debit
4. 오늘 지출 내역 list
   - 확인 필요 badge
   - 지출 상세/분할 정리로 진입

## 동행자

목적: 초대와 참여 상태를 관리합니다.

구성:

- 초대 링크 card
- `복사`, `메시지로 공유` action
- 참여자 list
- Owner/Member badge

## 빠른 지출 sheet

목적: 여행 중 10초 안에 지출을 저장합니다.

구성:

- 현재 장소/근처 장소 context
- 금액 input: 우측 정렬, 통화 prefix/suffix
- 결제자 chip
- 분할 방식 segmented control: `전체 1/N`, `일부`, `나만`
- primary `저장`

## 장소 추가 sheet

구성:

- 장소 검색 input
- 검색 결과 list
- 선택 후 장소 타입 chip
- 추가할 Day chip
- `Day N에 추가`

## 도메인 primitive 후보

반복 구현이 시작되면 아래 primitive를 `apps/mobile/lib/design/` 또는 별도 UI 폴더로 승격합니다.

- `Button`
- `Card`
- `Badge`
- `Chip`
- `SegmentedControl`
- `ListRow`
- `Avatar`
- `PlaceTag`
- `AmountText`
