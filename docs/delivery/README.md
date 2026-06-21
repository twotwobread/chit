# Delivery 문서

이 디렉터리는 이음(i-um)의 기능 개발과 배포 흐름을 정의한다.

이 프로젝트는 기능을 수평 레이어별로 나누어 개발하지 않는다. 예를 들어 DB만 먼저 만들거나, API만 먼저 만들거나, UI만 먼저 만드는 방식을 기본으로 하지 않는다.

대신 각 기능은 사용자가 실제 앱에서 확인할 수 있는 **vertical slice**로 개발한다.

```text
Feature Slice = App UI + API Contract + API Server + DB + Tests + Deployable State
```

## 문서 구성

- `feature_delivery_workflow.md`
  - GitHub Issue, Ouroboros, feature spec, pi coding agent, 배포까지의 전체 흐름
- `definition_of_done.md`
  - 기능을 완료로 볼 수 있는 기준
- `staging_internal_deploy.md`
  - GCP Cloud Run staging API와 Expo internal build 배포 runbook
- `../features/_template.md`
  - 기능별 spec + implementation plan 작성 템플릿

## 기본 원칙

1. 기능 단위는 GitHub Issue로 관리한다.
2. 구현 전 `docs/features/` 하위에 기능별 spec + plan 문서를 작성한다.
3. 모호한 요구사항은 Ouroboros로 먼저 구체화한다.
4. 기능 구현은 App UI, API Server, DB, OpenAPI, 테스트를 함께 포함한다.
5. 기능 완료 시점에는 staging 또는 internal build에서 검증 가능한 상태여야 한다.
6. Spec에 없는 기능은 구현하지 않는다.
7. API 변경은 OpenAPI 계약을 먼저 수정한다.

## 빠른 시작

새 기능을 시작할 때는 다음 순서로 진행한다.

```text
1. GitHub Issue 생성
2. Ouroboros interview/pm으로 요구사항 구체화
3. docs/features/<feature>.md 작성
4. Issue에 feature spec 문서 링크
5. Spec review / approve
6. pi coding agent로 구현
7. Definition of Done 검증
8. staging/internal build 확인
9. Issue close
```

자세한 내용은 `feature_delivery_workflow.md`를 따른다.
