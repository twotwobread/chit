# 기술 설계 문서

## 개요

이음(i-um)은 모바일 앱과 API 서버를 하나의 저장소에서 관리하는 모노레포로
구성한다.

초기 MVP는 다음 기능을 중심으로 구현한다.

- 여행 일정 등록
- 동행자 초대 및 공동 일정 관리
- Google Maps 길찾기 연결
- 빠른 지출 등록
- 여행 참여자 공유 정산

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 모바일 | React Native + Expo | 앱 중심 제품이므로 웹은 MVP 범위 제외 |
| API 서버 | Go | REST API 서버 |
| HTTP Router | chi | `net/http` 기반, OpenAPI tooling과 궁합 좋음 |
| API 계약 | OpenAPI | API contract source of truth |
| Go 코드 생성 | oapi-codegen | OpenAPI 기반 server interface 생성 |
| 모바일 Client 생성 | OpenAPI 기반 TS client | Expo 앱에서 타입 안정성 확보 |
| DB | PostgreSQL | 운영 기준 기본 DB |
| SQL | sqlc + pgx | 타입 안전한 SQL 사용 |
| Migration | goose | DB schema migration |
| Package Manager | pnpm | Expo 및 codegen script 관리 |

## 모노레포 구조

```text
i-um/
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── trips/
│   │   │   ├── itinerary/
│   │   │   ├── expenses/
│   │   │   └── settlements/
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   └── maps/
│   │   ├── assets/
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── api/
│       ├── cmd/
│       │   └── api/
│       │       └── main.go
│       ├── internal/
│       │   ├── server/
│       │   ├── middleware/
│       │   ├── response/
│       │   ├── auth/
│       │   ├── trip/
│       │   ├── itinerary/
│       │   ├── place/
│       │   ├── expense/
│       │   ├── settlement/
│       │   └── storage/
│       ├── migrations/
│       ├── queries/
│       ├── gen/
│       │   ├── openapi/
│       │   └── db/
│       ├── sqlc.yaml
│       ├── go.mod
│       └── go.sum
│
├── packages/
│   └── api-contract/
│       ├── openapi.yaml
│       ├── package.json
│       └── gen/
│           └── ts/
│
├── docs/
│   ├── product/
│   └── architecture/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## API 개발 방식

API는 OpenAPI 계약을 먼저 정의하고, 서버와 모바일이 이 계약을 기준으로
구현한다.

```text
1. packages/api-contract/openapi.yaml 수정
2. oapi-codegen으로 Go server interface 생성
3. OpenAPI 기반 TypeScript client 생성
4. Go API 서버에서 generated interface 구현
5. Expo 앱에서 generated client 사용
6. 서버 테스트와 앱 타입 체크로 계약 준수 확인
```

## OpenAPI 사용 범위

### 초기부터 사용

- API endpoint 정의
- request/response schema 정의
- 공통 error response 정의
- Go server interface 생성
- 모바일 TypeScript type/client 생성

### 초기에는 보류

- OpenAPI 기반 전체 서버 stub 자동 생성
- 복잡한 contract diff 자동화
- public API 문서 포털
- 외부 개발자용 SDK 배포

## Go API 서버 구조

Go 서버는 HTTP 계층과 도메인 로직을 분리한다.

```text
internal/
├── server/
│   ├── server.go        # chi router, middleware, route registration
│   └── config.go
├── response/
│   ├── error.go         # 공통 에러 응답 변환
│   └── json.go          # JSON response helper
├── auth/
│   ├── middleware.go
│   └── context.go
├── trip/
│   ├── handler.go       # OpenAPI generated interface 구현
│   ├── service.go       # 비즈니스 로직
│   ├── repository.go
│   └── model.go
├── itinerary/
├── expense/
├── settlement/
└── storage/
    ├── db.go
    └── tx.go
```

### 계층 역할

| 계층 | 역할 |
|------|------|
| Handler | HTTP 요청/응답 처리, 인증 context 추출, service 호출 |
| Service | 도메인 규칙 처리, 트랜잭션 경계 결정 |
| Repository | DB query 호출, persistence 추상화 |
| sqlc generated queries | SQL 타입 안전성 제공 |

Handler에는 비즈니스 로직을 넣지 않는다. Handler는 OpenAPI request를
service input으로 변환하고, service 결과를 response로 변환하는 역할만 맡는다.

## 인증과 사용자

MVP에서는 복잡한 인증 기능보다 여행 초대와 정산 흐름 검증이 중요하다.

초기 선택지는 두 가지다.

### Option A. 간단한 자체 인증

- 이메일 기반 사용자 생성
- 비밀번호 또는 magic link는 후속 결정
- JWT access token 사용

### Option B. 임시 사용자 + 초대 링크

- MVP 검증용으로 기기별 임시 사용자 생성
- 초대 링크를 통해 여행 참여
- 정식 로그인은 후속 구현

초기 제품 검증 속도만 보면 Option B가 빠르다. 다만 정산 결과를 여러 기기에서
안정적으로 보려면 최소한 사용자 식별자는 서버에 저장해야 한다.

## 초대 모델

여행 초대는 링크 기반으로 시작한다.

```text
Owner가 초대 링크 생성
↓
초대 링크 공유
↓
초대받은 사용자가 링크 열기
↓
TripParticipant로 참여
```

초대 링크에는 만료 시간을 둔다.

MVP 권한은 단순화한다.

```text
Owner
- 여행 삭제 가능
- 참여자 초대 가능
- 참여자 제거 가능
- 일정 수정 가능
- 지출 등록/수정 가능
- 정산 확인 가능

Member
- 일정 수정 가능
- 지출 등록/수정 가능
- 정산 확인 가능
```

## 주요 도메인 모델

### User

서비스 사용자다.

주요 필드:

- id
- display_name
- created_at
- updated_at

### Trip

하나의 여행 단위다.

주요 필드:

- id
- name
- start_date
- end_date
- default_currency
- created_by
- created_at
- updated_at

### TripParticipant

여행에 참여한 사용자다.

주요 필드:

- id
- trip_id
- user_id
- role
- display_name
- joined_at

### TripDay

여행 안의 하루 단위 일정이다.

주요 필드:

- id
- trip_id
- date
- day_order

### TripPlace

여행 일정에 등록된 장소 참조와 선택 당시의 최소 스냅샷이다.

`TripPlace`는 전역 장소 마스터가 아니다. Google Places 등 외부 API에서 받은
장소 정보를 서비스 전체에서 영구 재사용하는 구조를 피하고, 사용자가 특정
여행에 추가한 목적지를 보존하는 도메인 모델로 둔다.

주요 필드:

- id
- trip_id
- source
- google_place_id
- name
- address
- latitude
- longitude
- place_type
- user_label
- user_memo
- selected_at
- last_refreshed_at
- refresh_status

`name`, `address`, `latitude`, `longitude`는 사용자가 장소를 선택한 시점의
표시용 스냅샷이다. 일정 목록, 오늘 실행 화면, 정산 연결 화면은 기본적으로
이 스냅샷을 사용해 렌더링하고, 화면 조회만으로 외부 Places API를 호출하지
않는다.

### ProviderPlaceCache

외부 장소 API 비용을 줄이기 위한 임시 캐시다.

주요 필드:

- id
- provider
- provider_place_id
- display_name
- formatted_address
- latitude
- longitude
- business_status
- maps_uri
- fetched_at
- expires_at

이 테이블은 제품 도메인 데이터가 아니라 provider 응답 캐시다. provider별
약관을 기준으로 저장 가능한 필드와 TTL을 제한한다. Google Maps Platform을
사용하는 경우 `place_id`는 장기 참조 키로 저장하되, Google이 제공한 장소
상세 데이터는 허용된 범위 안에서만 캐싱한다.

### ItineraryItem

특정 날짜에 방문할 장소다.

주요 필드:

- id
- trip_id
- trip_day_id
- trip_place_id
- item_order
- status
- added_by
- updated_by
- created_at
- updated_at

상태:

```text
pending
arrived
skipped
```

### Expense

여행 중 기록한 지출이다.

주요 필드:

- id
- trip_id
- itinerary_item_id
- paid_by_participant_id
- amount
- currency
- category
- memo
- spent_at
- created_by
- updated_by
- created_at
- updated_at

금액은 decimal string 또는 minor unit 중 하나로 통일한다. MVP에서는 통화별
소수점 처리를 단순화하기 위해 `amount_minor` 정수 저장을 우선 검토한다.

### ExpenseSplit

지출을 누가 얼마 부담하는지 나타낸다.

주요 필드:

- id
- expense_id
- participant_id
- amount
- split_type

MVP 기본값은 여행 참여자 전체 1/N이다.

### Settlement

저장 테이블이 아니라 계산 결과로 시작한다.

주요 필드:

- trip_id
- balances
- transfers

예:

```json
{
  "transfers": [
    {
      "fromParticipantId": "participant_1",
      "toParticipantId": "participant_2",
      "amount": "18500",
      "currency": "KRW"
    }
  ]
}
```

## DB 설계 초안

초기 테이블:

- users
- trips
- trip_participants
- trip_invites
- trip_days
- trip_places
- provider_place_cache
- itinerary_items
- expenses
- expense_splits

정산 결과는 매 요청마다 계산한다. 성능 문제가 생기면 snapshot table을 추가한다.

## 장소 데이터 저장 및 갱신 원칙

장소 데이터는 비용, 약관, 변경 가능성을 모두 고려해 다룬다.

### 기본 원칙

- `trip_places`는 특정 여행에 사용자가 추가한 장소 스냅샷이다.
- `provider_place_cache`는 외부 API 호출 비용을 줄이기 위한 TTL 캐시다.
- 전역 `places` 마스터를 만들어 외부 provider 장소 데이터를 서비스 전체에서
  영구 재사용하지 않는다.
- 여행 상세, 오늘 실행 화면, 정산 화면 조회만으로 Places API를 호출하지 않는다.
- 장소 검색과 선택 시점에 외부 API 호출을 집중시킨다.
- 저장 필드와 TTL은 provider 약관을 기준으로 제한한다.

### Google Places 사용 시 호출 전략

1. 사용자가 장소 검색어를 입력할 때만 autocomplete/search를 호출한다.
2. 검색 호출은 debounce, 최소 글자 수, session token으로 제어한다.
3. 사용자가 장소를 선택한 시점에만 Place Details를 호출한다.
4. Details 요청은 MVP 화면에 필요한 최소 필드로 제한한다.
5. 선택 결과는 `trip_places`에 표시용 스냅샷으로 저장한다.
6. 같은 `google_place_id`의 최근 캐시가 유효하면 `provider_place_cache`를
   우선 사용한다.
7. 길찾기 URL은 저장된 좌표 또는 `google_place_id`로 생성하고, 길찾기 버튼
   클릭만으로 Place Details를 다시 조회하지 않는다.

MVP에서 우선 사용하는 Details 필드는 다음으로 제한한다.

- display name
- formatted address
- latitude
- longitude
- business status
- Google Maps URI 또는 place id

리뷰, 사진, 상세 영업시간, 인기 시간대 등 비용과 변동성이 큰 정보는 MVP에서
제외한다.

### 장소 변경 대응

장소는 폐업, 이전, 이름 변경, 주소 변경이 발생할 수 있다. 기존 일정을
자동으로 덮어쓰지 않고, 변경 가능성을 사용자에게 알린 뒤 선택하게 한다.

상태 예시:

```text
unknown
valid
changed
closed
not_found
```

갱신은 제한적으로 수행한다.

- 여행 당일 첫 진입 시 오래된 장소만 일부 확인
- 사용자가 장소 상세를 열거나 변경 확인을 요청할 때 확인
- `last_refreshed_at`이 오래된 장소만 확인
- 한 화면의 모든 장소를 일괄 refresh하지 않음

변경이 감지되면 기존 `trip_places` 스냅샷은 보존하고 다음 선택지를 제공한다.

```text
이 장소 정보가 변경되었을 수 있습니다.
[업데이트] [그대로 두기] [다른 장소 선택]
```

## 정산 계산 원칙

정산은 다음 방식으로 계산한다.

1. 여행의 모든 expense를 조회한다.
2. 각 expense의 paid_by participant에게 결제 금액을 credit으로 더한다.
3. 각 expense_split의 participant에게 부담 금액을 debit으로 더한다.
4. participant별 balance를 계산한다.
5. 양수 balance는 받을 사람, 음수 balance는 보낼 사람으로 분류한다.
6. 최소 송금 건수에 가깝게 transfer 목록을 만든다.

예:

```text
민수: -18,500
현우: -7,200
지영: +25,700

민수 -> 지영 18,500
현우 -> 지영 7,200
```

MVP에서는 통화가 섞이는 여행을 제한하거나, 통화별로 별도 정산한다.

## API 엔드포인트 초안

### Trips

```text
POST   /trips
GET    /trips
GET    /trips/{tripId}
PATCH  /trips/{tripId}
DELETE /trips/{tripId}
```

### Participants / Invites

```text
POST   /trips/{tripId}/invites
GET    /trips/{tripId}/participants
POST   /trip-invites/{inviteToken}/accept
DELETE /trips/{tripId}/participants/{participantId}
```

### Itinerary

```text
POST   /trips/{tripId}/itinerary-items
PATCH  /itinerary-items/{itemId}
DELETE /itinerary-items/{itemId}
POST   /itinerary-items/{itemId}/arrive
POST   /itinerary-items/{itemId}/skip
```

### Expenses

```text
POST   /trips/{tripId}/expenses
GET    /trips/{tripId}/expenses
GET    /expenses/{expenseId}
PATCH  /expenses/{expenseId}
DELETE /expenses/{expenseId}
```

### Settlement

```text
GET    /trips/{tripId}/settlement
```

## 공통 API 규칙

### 날짜와 시간

- 날짜: `YYYY-MM-DD`
- 시간: ISO 8601 timestamp

### ID

- API 응답의 id는 string으로 표현한다.
- DB 내부 구현은 UUID 또는 ULID를 사용할 수 있다.

### 금액

금액은 부동소수점으로 처리하지 않는다.

권장:

```json
{
  "amountMinor": 320000,
  "currency": "KRW"
}
```

JPY처럼 minor unit이 없는 통화는 그대로 정수 금액을 사용한다.

### 에러 응답

모든 에러는 동일한 포맷을 사용한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "startDate is required",
    "details": []
  }
}
```

대표 code:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INTERNAL_ERROR`

## 모바일 앱 구조

Expo Router 기반으로 구성한다.

```text
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── trips/
│   │   ├── index.tsx
│   │   ├── new.tsx
│   │   └── [tripId]/
│   │       ├── index.tsx
│   │       ├── itinerary.tsx
│   │       ├── expenses.tsx
│   │       ├── settlement.tsx
│   │       └── participants.tsx
│   └── invite/
│       └── [token].tsx
├── features/
│   ├── trips/
│   ├── itinerary/
│   ├── expenses/
│   └── settlements/
├── components/
└── lib/
    ├── api/
    └── maps/
```

## 모바일 주요 화면

### 여행 목록

- 내가 참여 중인 여행 목록
- 새 여행 생성
- 초대받은 여행 진입

### 오늘 실행 화면

- 다음 장소 카드
- 현재 위치 기준 길찾기
- 이전 장소 기준 길찾기
- 도착
- 스킵
- 숙소로 이동
- 빠른 지출 등록

### 일정 편집 화면

- 날짜별 장소 목록
- 장소 추가
- 장소 순서 변경
- 장소 삭제
- 참여자 변경 표시

### 참여자 화면

- 참여자 목록
- 초대 링크 생성
- 초대 링크 공유

### 지출 화면

- 빠른 지출 등록
- 장소별 지출 목록
- 참여자별 결제 금액
- 확인 필요한 지출

### 정산 화면

- 최종 송금 결과
- 사람별 부담/결제 요약
- 지출 상세 내역

## Google Maps 연동

정확한 길찾기는 앱 내부에서 구현하지 않는다.

모바일 앱은 Google Maps URL을 생성해 외부 앱 또는 웹으로 연결한다.

필요한 입력:

- origin
- destination
- travelmode

지원 travel mode:

- transit
- walking
- driving

## 동시 수정 처리

MVP에서는 실시간 동시 편집을 구현하지 않는다.

기본 전략:

- 서버 저장 시 `updated_at` 갱신
- 모바일은 저장 후 최신 trip detail 재조회
- 충돌 가능성이 큰 순서 변경은 서버에서 최종 order를 재계산

나중에 필요하면 optimistic locking 또는 revision number를 추가한다.

## 테스트 전략

### API 서버

- service 단위 테스트
- settlement 계산 테스트
- repository 통합 테스트
- handler 테스트

### 모바일

- 핵심 hook 테스트
- 정산 화면 렌더링 테스트
- Google Maps URL 생성 테스트

### 계약

- OpenAPI lint
- Go generated interface compile check
- TypeScript generated client type check

## 초기 구현 순서

1. 모노레포 스캐폴딩
2. OpenAPI 초안 작성
3. Go API 서버 부트스트랩
4. DB migration 및 sqlc 설정
5. Trip/Participant API 구현
6. Itinerary API 구현
7. Expense API 구현
8. Settlement 계산 구현
9. Expo 앱 스캐폴딩
10. 여행 목록/생성 화면
11. 오늘 실행 화면
12. 빠른 지출 등록 화면
13. 정산 화면
14. 초대 링크 플로우

## MVP 제외 기술

- Web app
- 자체 지도/내비게이션 엔진
- 실시간 협업 엔진
- OCR
- 카드/은행 연동
- 송금 연동
- 예약 서비스 직접 API 연동
- Push notification
- 관리자 페이지
