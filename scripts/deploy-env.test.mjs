import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildStageConfig,
  artifactImageUri,
  cloudRunEnvMapping,
  createSecretSpecs,
  deriveDirectDatabaseUrl,
  deriveInviteLinkHost,
  easEnvSpecs,
  legacyCloudRunEnvNames,
  notificationWorkerEnvMapping,
  notificationWorkerRunUri,
  notificationWorkerSecretMapping,
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

    assert.deepEqual(parseDeployArgs(['stage', '--only', 'notifications', '--platform', 'none']), {
      command: 'stage',
      dryRun: false,
      only: 'notifications',
      platform: 'none',
      wait: true,
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
    assert.equal(config.cloudRun.artifactRepository, 'i-um-staging');
    assert.equal(config.cloudRun.imageName, 'api');
    assert.equal(config.deploy.branch, 'develop');
    assert.equal(config.notificationWorker.jobName, 'i-um-notification-worker-staging');
    assert.equal(config.notificationWorker.schedulerJobName, 'i-um-notification-worker-staging-every-minute');
    assert.equal(config.notificationWorker.schedule, '* * * * *');
    assert.equal(config.notificationWorker.schedulerServiceAccount, 'i-um-notify-scheduler@i-um-488511.iam.gserviceaccount.com');
    assert.equal(config.apiEnv.AUTH_ALLOW_DEV_OAUTH, 'false');
    assert.equal(config.apiEnv.APPLE_CLIENT_ID, 'com.twotwobread.ium.staging');
    assert.equal(config.apiEnv.GCS_BUCKET, 'shared-gcs-bucket');
    assert.equal(config.apiEnv.GCS_SIGNING_ACCESS_ID, 'signer@i-um-488511.iam.gserviceaccount.com');
    assert.equal(config.apiEnv.RECEIPT_OPENAI_MODEL, 'gpt-4o-mini');
    assert.equal(config.eas.env.EXPO_PUBLIC_AUTH_DEV_MODE, 'false');
    assert.equal(config.apiEnv.INVITE_BASE_URL, undefined);
    assert.equal(config.eas.env.EXPO_PUBLIC_INVITE_LINK_HOST, undefined);
  });

  it('requires server, shared GCS storage, and mobile credentials for real Apple/Kakao staging login', () => {
    assert.throws(
      () => buildStageConfig({ env: { DATABASE_URL: 'postgresql://u:p@example.test/db' } }),
      /AUTH_TOKEN_SECRET, GOOGLE_MAPS_API_KEY, GCS_BUCKET, GCS_SIGNING_ACCESS_ID, GCS_SIGNING_PRIVATE_KEY, OPENAI_API_KEY, EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY/,
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

  it('carries the Android Google Maps SDK key into EAS environment config', () => {
    const config = buildStageConfig({
      env: requiredStageEnv({ EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY: 'android-maps-key' }),
    });

    assert.equal(config.eas.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY, 'android-maps-key');
    assert.deepEqual(
      easEnvSpecs(config, 'https://api.example.com')
        .filter((spec) => spec.name === 'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY')
        .map((spec) => [spec.value, spec.visibility]),
      [['android-maps-key', 'sensitive']],
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

describe('env examples', () => {
  it('keeps local and staging runtime keys aligned while keeping deploy-only keys in staging', () => {
    const localEnv = parseDotenv(readFileSync('.env.example', 'utf8'));
    const stageEnv = parseDotenv(readFileSync('.env.stage.example', 'utf8'));
    const runtimeKeys = [
      'DATABASE_URL',
      'AUTH_TOKEN_SECRET',
      'AUTH_ALLOW_DEV_OAUTH',
      'APPLE_CLIENT_ID',
      'GOOGLE_MAPS_API_KEY',
      'GCS_BUCKET',
      'GCS_SIGNING_ACCESS_ID',
      'GCS_SIGNING_PRIVATE_KEY',
      'OPENAI_API_KEY',
      'RECEIPT_OPENAI_MODEL',
      'INVITE_BASE_URL',
      'INVITE_APP_SCHEME',
      'INVITE_APP_STORE_URL',
      'INVITE_PLAY_STORE_URL',
      'EXPO_PUBLIC_AUTH_DEV_MODE',
      'EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY',
      'EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY',
      'EXPO_PUBLIC_INVITE_LINK_HOST',
    ];

    for (const key of runtimeKeys) {
      assert.ok(key in localEnv, `${key} missing from .env.example`);
      assert.ok(key in stageEnv, `${key} missing from .env.stage.example`);
    }

    assert.ok(!('OPENAI_API_KEY_SECRET_NAME' in localEnv), 'local env example must not include deploy-only secret names');
    assert.equal(stageEnv.OPENAI_API_KEY_SECRET_NAME, 'i-um-staging-openai-api-key');
    assert.equal(stageEnv.NOTIFICATION_WORKER_JOB, 'i-um-notification-worker-staging');
    assert.equal(stageEnv.NOTIFICATION_WORKER_SCHEDULER_JOB, 'i-um-notification-worker-staging-every-minute');
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
        ['GOOGLE_MAPS_API_KEY', 'i-um-staging-google-maps-api-key', 'maps-key'],
        ['GCS_SIGNING_PRIVATE_KEY', 'i-um-staging-gcs-signing-private-key', 'private-key-pem'],
        ['OPENAI_API_KEY', 'i-um-staging-openai-api-key', 'openai-key'],
      ],
    );
  });

  it('includes the optional Expo push access token secret only when configured', () => {
    const specs = createSecretSpecs(
      buildStageConfig({ env: requiredStageEnv({ EXPO_PUSH_ACCESS_TOKEN: 'expo-token' }) }),
    );

    assert.ok(specs.some((spec) => spec.envName === 'EXPO_PUSH_ACCESS_TOKEN'));
    assert.ok(!createSecretSpecs(buildStageConfig({ env: requiredStageEnv() })).some((spec) => spec.envName === 'EXPO_PUSH_ACCESS_TOKEN'));
  });
});

describe('legacyCloudRunEnvNames', () => {
  it('lists old env names removed from Cloud Run after canonical env consolidation', () => {
    assert.deepEqual(legacyCloudRunEnvNames(), [
      'APPLE_BUNDLE_ID',
      'GOOGLE_PLACES_API_KEY',
      'GOOGLE_ROUTES_API_KEY',
      'BOARDING_PASS_GCS_BUCKET',
      'BOARDING_PASS_GCS_SIGNING_ACCESS_ID',
      'BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY',
      'EXPENSE_RECEIPT_GCS_BUCKET',
      'EXPENSE_RECEIPT_GCS_SIGNING_ACCESS_ID',
      'EXPENSE_RECEIPT_GCS_SIGNING_PRIVATE_KEY',
    ]);
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

describe('notification worker deploy config', () => {
  it('builds image, job secret/env mappings, and scheduler run URI', () => {
    const config = buildStageConfig({ env: requiredStageEnv({ EXPO_PUSH_ACCESS_TOKEN: 'expo-token' }) });

    assert.equal(
      artifactImageUri(config),
      'asia-northeast3-docker.pkg.dev/i-um-488511/i-um-staging/api:latest',
    );
    assert.equal(
      notificationWorkerSecretMapping(config),
      'DATABASE_URL=i-um-staging-database-url:latest,EXPO_PUSH_ACCESS_TOKEN=i-um-staging-expo-push-access-token:latest',
    );
    assert.equal(
      notificationWorkerEnvMapping(config),
      '^|^NOTIFICATION_WORKER_BATCH_SIZE=50|NOTIFICATION_WORKER_MAX_ATTEMPTS=8|NOTIFICATION_WORKER_STALE_RUNNING_MINUTES=10|NOTIFICATION_WORKER_MAX_BATCHES=20',
    );
    assert.equal(
      notificationWorkerRunUri(config),
      'https://run.googleapis.com/v2/projects/i-um-488511/locations/asia-northeast3/jobs/i-um-notification-worker-staging:run',
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
    GOOGLE_MAPS_API_KEY: 'maps-key',
    GCS_BUCKET: 'shared-gcs-bucket',
    GCS_SIGNING_ACCESS_ID: 'signer@i-um-488511.iam.gserviceaccount.com',
    GCS_SIGNING_PRIVATE_KEY: 'private-key-pem',
    OPENAI_API_KEY: 'openai-key',
    EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: 'kakao-key',
    ...overrides,
  };
}
