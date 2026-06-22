# 이음 디자인 기준

이 문서는 임시 `design/` 산출물에서 프로젝트에 필요한 기준만 옮긴 정본입니다. 제품 UI 작업은 여기와 `apps/mobile/lib/design/theme.ts`를 기준으로 합니다.

## 제품 방향

이음(i-um)은 여행 중 **다음 일정**과 **공동 지출**을 한 흐름으로 이어주는 공동 여행 실행 앱입니다. 예약/검색 서비스가 아니라 여행 현장에서 다음 행동을 빠르게 확인하고, 동행자와 일정·지출을 함께 정리하는 실행 도구입니다.

MVP 주요 표면:

- **오늘**: 현재 Day, 다음 장소, 도착/스킵/숙소로/길찾기, 오늘 지출 요약
- **일정**: Day별 장소 순서, 지도 핀 번호, 장소 간 이동 시간
- **정산**: 빠른 지출 입력, 지출 목록, 최종 송금 결과
- **동행자**: 초대 링크, 참여자 목록, 공동 편집

## 보이스

- 한국어 우선. 영어는 `i-um`, 짧은 보조 label 정도로 제한합니다.
- 친근한 존댓말을 씁니다. `~예요`, `~할게요`, `~남았어요` 계열을 선호합니다.
- 현장에서 읽기 쉽게 짧게 씁니다.
- 상태 설명보다 다음 행동을 먼저 보여줍니다.
- 제품 UI에서 이모지는 사용하지 않습니다.
- 금액은 콤마를 넣고 한국어 suffix를 기본으로 씁니다. 예: `18,500원`, `3,200엔`.

좋은 예:

- `다음 장소예요. 도착하면 알려드릴게요.`
- `3,200엔 저장됨 · 전체 1/N`
- `지영이 추가한 장소예요.`

피할 예:

- `목적지 정보를 성공적으로 등록하였습니다.`
- `지출 등록이 완료되었습니다!! 🎉`
- `A new place has been added by 지영.`

## 비주얼 원칙

- 무드: 따뜻한 햇빛, 차분함, 신뢰, 낮은 chrome, 높은 가독성
- 배경: warm off-white `theme.color.bg`
- 표면: white card + hairline border + 낮은 shadow
- 브랜드 컬러: 이음 그린 `theme.color.primary` (`#098563`)
- 지출/정산 accent: amber `theme.color.accent` (`#f08c00`)
- 금액 의미:
  - 받을 돈: `theme.color.credit`, `+`
  - 보낼 돈: `theme.color.debit`, `−`
- 타입: Pretendard를 기본 서체로 사용합니다. 모바일 앱은 `apps/mobile/assets/fonts/`의 Regular/SemiBold/Bold를 `expo-font`로 로드합니다.
- 간격: 4px grid. 화면 좌우 gutter는 20px.
- 터치: 최소 44px, 일반 control 48px, 핵심 action 56px.
- 라운딩: control 12, card 16, sheet/hero 28.
- 모션: 빠르고 부드럽게 120–320ms. 장식적 bounce/loop는 피합니다.

## 코드 위치

- 모바일 토큰: `apps/mobile/lib/design/theme.ts`
- 모바일 브랜드 에셋: `apps/mobile/assets/brand/`
- 모바일 폰트 에셋: `apps/mobile/assets/fonts/` (`Pretendard-LICENSE.txt` 포함)
- 화면 패턴: `docs/design/mobile-ui-reference.md`

## 구현 규칙

- 색/간격/라운딩/그림자/타입 값은 `theme`에서 가져옵니다.
- 새 hex/px를 화면 코드에 직접 추가하지 않습니다. 외부 브랜드 색상도 먼저 token으로 둡니다.
- 버튼/카드/리스트 행/배지/칩 등 UI 패턴이 두 번째로 필요해지는 순간 중복 구현하지 말고 앱 공용 primitive로 먼저 승격합니다.
- 금액 UI는 tabular 숫자 정렬과 credit/debit 색 의미를 유지합니다.
- 아이콘은 향후 하나의 line icon set으로 통일합니다. 아이콘처럼 보이는 이모지/임의 unicode는 쓰지 않습니다.

## 임시 디자인 산출물 처리

원본 `design/`에는 웹 React 컴포넌트, HTML 카드, 번들, zip이 포함되어 있었지만 현재 앱은 Expo/React Native입니다. 그래서 다음만 정본으로 반영했습니다.

- 브랜드/보이스/토큰/화면 패턴 문서
- RN용 디자인 토큰
- 브랜드 SVG 에셋

웹 전용 컴포넌트와 generated bundle은 앱 코드에 직접 반영하지 않습니다.
