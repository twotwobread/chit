import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildStageConfig,
  cloudRunEnvMapping,
  createSecretSpecs,
  deriveDirectDatabaseUrl,
  deriveInviteLinkHost,
  parseDeployArgs,
  parseDotenv,
  resolvePublicEndpoints,
} from './deploy-env.mjs';

describe('parseDotenv', () => {
  it('parses comments, quoted values, and inline comments without exposing values', () => {
    const env = parseDotenv(`
# comment
GCP_PROJECT_ID=i-um-488511
AUTH_TOKEN_SECRET="quoted secret"
INVITE_BASE_URL=https://invite.example.com # public comment
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY='native-key'
EMPTY=
`);

    assert.deepEqual(env, {
      GCP_PROJECT_ID: 'i-um-488511',
      AUTH_TOKEN_SECRET: 'quoted secret',
      INVITE_BASE_URL: 'https://invite.example.com',
      EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'native-key',
      EMPTY: '',
    });
  });
});

describe('parseDeployArgs', () => {
  it('defaults stage deploys to full ios flow and supports narrowing', () => {
    assert.deepEqual(parseDeployArgs(['stage']), {
      command: 'stage',
      dryRun: false,
      only: 'all',
      platform: 'ios',
      wait: true,
    });

    assert.deepEqual(parseDeployArgs(['stage', '--dry-run', '--only', 'mobile', '--platform', 'android', '--no-wait']), {
      command: 'stage',
      dryRun: true,
      only: 'mobile',
      platform: 'android',
      wait: false,
    });

    assert.deepEqual(parseDeployArgs(['stage', '--', '--dry-run']), {
      command: 'stage',
      dryRun: true,
      only: 'all',
      platform: 'ios',
      wait: true,
    });
  });
});

describe('buildStageConfig', () => {
  it('derives staging defaults and validates real-login env', () => {
    const config = buildStageConfig({ env: requiredStageEnv() });

    assert.equal(config.gcp.projectId, 'i-um-488511');
    assert.equal(config.gcp.region, 'asia-northeast3');
    assert.equal(config.cloudRun.service, 'i-um-api-staging');
    assert.equal(config.deploy.branch, 'develop');
    assert.equal(config.apiEnv.AUTH_ALLOW_DEV_OAUTH, 'false');
    assert.equal(config.apiEnv.APPLE_BUNDLE_ID, 'com.twotwobread.ium.staging');
    assert.equal(config.apiEnv.BOARDING_PASS_GCS_BUCKET, 'boarding-pass-bucket');
    assert.equal(config.apiEnv.BOARDING_PASS_GCS_SIGNING_ACCESS_ID, 'signer@i-um-488511.iam.gserviceaccount.com');
    assert.equal(config.eas.env.EXPO_PUBLIC_AUTH_DEV_MODE, 'false');
    assert.equal(config.apiEnv.INVITE_BASE_URL, undefined);
    assert.equal(config.eas.env.EXPO_PUBLIC_INVITE_LINK_HOST, undefined);
  });

  it('requires server, boarding pass storage, and mobile credentials for real Apple/Kakao staging login', () => {
    assert.throws(
      () => buildStageConfig({ env: { DATABASE_URL: 'postgresql://u:p@example.test/db' } }),
      /AUTH_TOKEN_SECRET, GOOGLE_PLACES_API_KEY, GOOGLE_ROUTES_API_KEY, BOARDING_PASS_GCS_BUCKET, BOARDING_PASS_GCS_SIGNING_ACCESS_ID, BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY, EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY/,
    );
  });

  it('rejects replace-with placeholders for required deployment values', () => {
    assert.throws(
      () =>
        buildStageConfig({
          env: requiredStageEnv({
            DATABASE_URL: 'replace-with-neon-pooled-postgresql-url',
            AUTH_TOKEN_SECRET: 'replace-with-long-random-secret',
          }),
        }),
      /AUTH_TOKEN_SECRET, DATABASE_URL/,
    );
  });

  it('rejects embedded placeholders in optional active deployment values', () => {
    assert.throws(
      () =>
        buildStageConfig({
          env: requiredStageEnv({
            INVITE_APP_STORE_URL: 'https://apps.apple.com/app/replace-with-app-id',
          }),
        }),
      /INVITE_APP_STORE_URL/,
    );
  });
});

describe('resolvePublicEndpoints', () => {
  it('uses the Cloud Run URL for invite URLs but leaves native app-link host disabled when no owned invite domain is configured', () => {
    const config = buildStageConfig({ env: requiredStageEnv() });

    const resolved = resolvePublicEndpoints(config, 'https://i-um-api-staging-example-uc.a.run.app');

    assert.equal(resolved.apiEnv.INVITE_BASE_URL, 'https://i-um-api-staging-example-uc.a.run.app');
    assert.equal(resolved.eas.env.EXPO_PUBLIC_API_BASE_URL, 'https://i-um-api-staging-example-uc.a.run.app');
    assert.equal(resolved.eas.env.EXPO_PUBLIC_INVITE_LINK_HOST, undefined);
  });

  it('keeps an explicitly configured app-link host for an owned invite domain', () => {
    const config = buildStageConfig({
      env: requiredStageEnv({
        INVITE_BASE_URL: 'https://links.example.com',
        EXPO_PUBLIC_INVITE_LINK_HOST: 'links.example.com',
      }),
    });

    const resolved = resolvePublicEndpoints(config, 'https://i-um-api-staging-example-uc.a.run.app');

    assert.equal(resolved.apiEnv.INVITE_BASE_URL, 'https://links.example.com');
    assert.equal(resolved.eas.env.EXPO_PUBLIC_INVITE_LINK_HOST, 'links.example.com');
  });
});

describe('createSecretSpecs', () => {
  it('maps required values to stable Secret Manager names', () => {
    const specs = createSecretSpecs(buildStageConfig({ env: requiredStageEnv() }));

    assert.deepEqual(
      specs.map((spec) => [spec.envName, spec.secretName, spec.value]),
      [
        ['DATABASE_URL', 'i-um-staging-database-url', 'postgresql://user:pass@ep-test-pooler.ap-northeast-1.aws.neon.tech/ium?sslmode=require'],
        ['AUTH_TOKEN_SECRET', 'i-um-staging-auth-token-secret', 'long-secret'],
        ['GOOGLE_PLACES_API_KEY', 'i-um-staging-google-places-api-key', 'places-key'],
        ['GOOGLE_ROUTES_API_KEY', 'i-um-staging-google-routes-api-key', 'routes-key'],
        ['BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY', 'i-um-staging-boarding-pass-gcs-signing-private-key', 'private-key-pem'],
      ],
    );
  });
});

describe('cloudRunEnvMapping', () => {
  it('uses a custom delimiter so comma-separated app link values survive gcloud parsing', () => {
    assert.equal(
      cloudRunEnvMapping({ AUTH_ALLOW_DEV_OAUTH: 'false', INVITE_IOS_APP_IDS: 'TEAM.one,TEAM.two' }),
      '^|^AUTH_ALLOW_DEV_OAUTH=false|INVITE_IOS_APP_IDS=TEAM.one,TEAM.two',
    );
  });
});

describe('deriveDirectDatabaseUrl', () => {
  it('converts Neon pooled host to direct host for goose migrations', () => {
    assert.equal(
      deriveDirectDatabaseUrl('postgresql://user:pass@ep-test-pooler.ap-northeast-1.aws.neon.tech/ium?sslmode=require'),
      'postgresql://user:pass@ep-test.ap-northeast-1.aws.neon.tech/ium?sslmode=require',
    );
  });
});

describe('deriveInviteLinkHost', () => {
  it('derives host from invite base url when not explicitly provided', () => {
    assert.equal(deriveInviteLinkHost('https://invite.example.com/invite'), 'invite.example.com');
  });
});

function requiredStageEnv(overrides = {}) {
  return {
    DATABASE_URL: 'postgresql://user:pass@ep-test-pooler.ap-northeast-1.aws.neon.tech/ium?sslmode=require',
    AUTH_TOKEN_SECRET: 'long-secret',
    GOOGLE_PLACES_API_KEY: 'places-key',
    GOOGLE_ROUTES_API_KEY: 'routes-key',
    BOARDING_PASS_GCS_BUCKET: 'boarding-pass-bucket',
    BOARDING_PASS_GCS_SIGNING_ACCESS_ID: 'signer@i-um-488511.iam.gserviceaccount.com',
    BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY: 'private-key-pem',
    EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'kakao-key',
    ...overrides,
  };
}
