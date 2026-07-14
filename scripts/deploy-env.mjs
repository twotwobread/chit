import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const DEFAULTS = Object.freeze({
  gcpProjectId: 'i-um-488511',
  gcpRegion: 'asia-northeast3',
  cloudBuildRegion: 'asia-northeast3',
  cloudRunService: 'i-um-api-staging',
  cloudBuildTrigger: 'i-um-api-staging-deploy',
  deployBranch: 'develop',
  runtimeServiceAccount: 'i-um-api-staging-run@i-um-488511.iam.gserviceaccount.com',
  databaseUrlSecretName: 'i-um-staging-database-url',
  authTokenSecretName: 'i-um-staging-auth-token-secret',
  googlePlacesSecretName: 'i-um-staging-google-places-api-key',
  googleRoutesSecretName: 'i-um-staging-google-routes-api-key',
  boardingPassGcsSigningPrivateKeySecretName: 'i-um-staging-boarding-pass-gcs-signing-private-key',
  appleBundleId: 'com.twotwobread.ium.staging',
  androidPackage: 'com.twotwobread.ium',
  inviteAppScheme: 'ium',
  easProjectDir: 'apps/mobile',
  easEnvironment: 'preview',
  easBuildProfile: 'preview',
});

const VALID_ONLY = new Set(['all', 'api', 'mobile', 'secrets', 'db', 'smoke', 'eas-env']);
const VALID_PLATFORMS = new Set(['ios', 'android', 'all', 'none']);
const PLACEHOLDER_PATTERN = /replace-with|change-me|todo|tbd|<[^>]+>/i;

export function parseDotenv(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const rawValue = stripInlineComment(line.slice(equalsIndex + 1).trim()).trim();
    env[key] = unquoteValue(rawValue);
  }
  return env;
}

export function parseDeployArgs(argv) {
  const args = [...argv];
  const command = args.shift() ?? '';
  const options = {
    command,
    dryRun: false,
    only: 'all',
    platform: 'ios',
    wait: true,
  };

  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case '--':
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--only':
        options.only = requireOptionValue(arg, args);
        break;
      case '--platform':
        options.platform = requireOptionValue(arg, args);
        break;
      case '--wait':
        options.wait = true;
        break;
      case '--no-wait':
        options.wait = false;
        break;
      default:
        throw new Error(`Unknown deploy option: ${arg}`);
    }
  }

  if (options.command !== 'stage') {
    throw new Error(`Usage: pnpm deploy stage [--dry-run] [--only ${Array.from(VALID_ONLY).join('|')}] [--platform ios|android|all|none] [--no-wait]`);
  }
  if (!VALID_ONLY.has(options.only)) {
    throw new Error(`Invalid --only value: ${options.only}`);
  }
  if (!VALID_PLATFORMS.has(options.platform)) {
    throw new Error(`Invalid --platform value: ${options.platform}`);
  }

  return options;
}

export function readDotenvFile(path) {
  return parseDotenv(readFileSync(path, 'utf8'));
}

export function buildStageConfig({ env }) {
  const merged = { ...env };
  const routesApiKey = valueOrFallback(merged.GOOGLE_ROUTES_API_KEY, merged.GOOGLE_MAPS_API_KEY);
  const authAllowDevOauth = valueOrDefault(merged.AUTH_ALLOW_DEV_OAUTH, 'false');
  const expoAuthDevMode = valueOrDefault(merged.EXPO_PUBLIC_AUTH_DEV_MODE, 'false');
  const appleBundleId = valueOrDefault(merged.APPLE_BUNDLE_ID, valueOrDefault(merged.IOS_BUNDLE_IDENTIFIER, DEFAULTS.appleBundleId));
  const inviteBaseUrl = optionalValue(merged.INVITE_BASE_URL);
  const inviteLinkHost = optionalValue(merged.EXPO_PUBLIC_INVITE_LINK_HOST) ?? (inviteBaseUrl ? deriveInviteLinkHost(inviteBaseUrl) : undefined);
  const projectId = valueOrDefault(merged.GCP_PROJECT_ID, DEFAULTS.gcpProjectId);
  const runtimeServiceAccount = valueOrDefault(
    merged.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT,
    DEFAULTS.runtimeServiceAccount.replace(`@${DEFAULTS.gcpProjectId}.`, `@${projectId}.`),
  );

  assertFalse('AUTH_ALLOW_DEV_OAUTH', authAllowDevOauth);
  assertFalse('EXPO_PUBLIC_AUTH_DEV_MODE', expoAuthDevMode);

  assertNoActivePlaceholders(merged);

  const required = [
    ['DATABASE_URL', merged.DATABASE_URL],
    ['AUTH_TOKEN_SECRET', merged.AUTH_TOKEN_SECRET],
    ['GOOGLE_PLACES_API_KEY', merged.GOOGLE_PLACES_API_KEY],
    ['GOOGLE_ROUTES_API_KEY', routesApiKey],
    ['BOARDING_PASS_GCS_BUCKET', merged.BOARDING_PASS_GCS_BUCKET],
    ['BOARDING_PASS_GCS_SIGNING_ACCESS_ID', merged.BOARDING_PASS_GCS_SIGNING_ACCESS_ID],
    ['BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY', merged.BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY],
    ['EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY', merged.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY],
  ];
  const missing = required.filter(([, value]) => !isUsableValue(value)).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing required .env.stage values for real staging deploy: ${missing.join(', ')}`);
  }

  const apiEnv = compactObject({
    AUTH_ALLOW_DEV_OAUTH: 'false',
    APPLE_BUNDLE_ID: appleBundleId,
    APPLE_CLIENT_ID: optionalValue(merged.APPLE_CLIENT_ID),
    BOARDING_PASS_GCS_BUCKET: optionalValue(merged.BOARDING_PASS_GCS_BUCKET),
    BOARDING_PASS_GCS_SIGNING_ACCESS_ID: optionalValue(merged.BOARDING_PASS_GCS_SIGNING_ACCESS_ID),
    INVITE_BASE_URL: inviteBaseUrl,
    INVITE_APP_SCHEME: valueOrDefault(merged.INVITE_APP_SCHEME, DEFAULTS.inviteAppScheme),
    INVITE_IOS_APP_IDS: optionalValue(merged.INVITE_IOS_APP_IDS),
    INVITE_ANDROID_PACKAGE_NAME: valueOrDefault(merged.INVITE_ANDROID_PACKAGE_NAME, valueOrDefault(merged.ANDROID_PACKAGE, DEFAULTS.androidPackage)),
    INVITE_ANDROID_SHA256_CERT_FINGERPRINTS: optionalValue(merged.INVITE_ANDROID_SHA256_CERT_FINGERPRINTS),
    INVITE_APP_STORE_URL: optionalValue(merged.INVITE_APP_STORE_URL),
    INVITE_PLAY_STORE_URL: optionalValue(merged.INVITE_PLAY_STORE_URL),
  });

  return {
    rawEnv: merged,
    gcp: {
      projectId,
      region: valueOrDefault(merged.GCP_REGION, DEFAULTS.gcpRegion),
      cloudBuildRegion: valueOrDefault(merged.CLOUD_BUILD_REGION, DEFAULTS.cloudBuildRegion),
      runtimeServiceAccount,
    },
    cloudRun: {
      service: valueOrDefault(merged.CLOUD_RUN_SERVICE, DEFAULTS.cloudRunService),
    },
    cloudBuild: {
      trigger: valueOrDefault(merged.CLOUD_BUILD_TRIGGER, DEFAULTS.cloudBuildTrigger),
    },
    deploy: {
      branch: valueOrDefault(merged.DEPLOY_BRANCH, DEFAULTS.deployBranch),
    },
    secretNames: {
      DATABASE_URL: valueOrDefault(merged.DATABASE_URL_SECRET_NAME, DEFAULTS.databaseUrlSecretName),
      AUTH_TOKEN_SECRET: valueOrDefault(merged.AUTH_TOKEN_SECRET_NAME, DEFAULTS.authTokenSecretName),
      GOOGLE_PLACES_API_KEY: valueOrDefault(merged.GOOGLE_PLACES_API_KEY_SECRET_NAME, DEFAULTS.googlePlacesSecretName),
      GOOGLE_ROUTES_API_KEY: valueOrDefault(merged.GOOGLE_ROUTES_API_KEY_SECRET_NAME, DEFAULTS.googleRoutesSecretName),
      BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY: valueOrDefault(
        merged.BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY_SECRET_NAME,
        DEFAULTS.boardingPassGcsSigningPrivateKeySecretName,
      ),
    },
    secrets: {
      DATABASE_URL: merged.DATABASE_URL,
      AUTH_TOKEN_SECRET: merged.AUTH_TOKEN_SECRET,
      GOOGLE_PLACES_API_KEY: merged.GOOGLE_PLACES_API_KEY,
      GOOGLE_ROUTES_API_KEY: routesApiKey,
      BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY: merged.BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY,
    },
    apiEnv,
    eas: {
      projectDir: valueOrDefault(merged.EAS_PROJECT_DIR, DEFAULTS.easProjectDir),
      environment: valueOrDefault(merged.EAS_ENVIRONMENT, DEFAULTS.easEnvironment),
      buildProfile: valueOrDefault(merged.EAS_BUILD_PROFILE, DEFAULTS.easBuildProfile),
      env: {
        EXPO_PUBLIC_API_BASE_URL: optionalValue(merged.EXPO_PUBLIC_API_BASE_URL),
        EXPO_PUBLIC_AUTH_DEV_MODE: 'false',
        EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY: merged.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY,
        EXPO_PUBLIC_INVITE_LINK_HOST: inviteLinkHost,
      },
    },
  };
}

export function resolvePublicEndpoints(config, cloudRunUrl) {
  const apiBaseUrl = optionalValue(cloudRunUrl) ?? optionalValue(config.eas.env.EXPO_PUBLIC_API_BASE_URL);
  const explicitInviteBaseUrl = optionalValue(config.apiEnv.INVITE_BASE_URL);
  const explicitInviteLinkHost = optionalValue(config.eas.env.EXPO_PUBLIC_INVITE_LINK_HOST);
  const inviteBaseUrl = explicitInviteBaseUrl ?? apiBaseUrl;
  const inviteLinkHost = explicitInviteLinkHost ?? (explicitInviteBaseUrl ? deriveInviteLinkHost(explicitInviteBaseUrl) : undefined);

  return {
    ...config,
    apiEnv: compactObject({
      ...config.apiEnv,
      INVITE_BASE_URL: inviteBaseUrl,
    }),
    eas: {
      ...config.eas,
      env: compactObject({
        ...config.eas.env,
        EXPO_PUBLIC_API_BASE_URL: apiBaseUrl,
        EXPO_PUBLIC_INVITE_LINK_HOST: inviteLinkHost,
      }),
    },
  };
}

export function createSecretSpecs(config) {
  return Object.entries(config.secrets).map(([envName, value]) => ({
    envName,
    secretName: config.secretNames[envName],
    value,
  }));
}

export function deriveDirectDatabaseUrl(databaseUrl) {
  return databaseUrl.replace('-pooler.', '.');
}

export function deriveInviteLinkHost(inviteBaseUrl) {
  try {
    return new URL(inviteBaseUrl).hostname;
  } catch {
    return '';
  }
}

export function cloudRunSecretMapping(config) {
  return createSecretSpecs(config)
    .map((spec) => `${spec.envName}=${spec.secretName}:latest`)
    .join(',');
}

export function cloudRunEnvMapping(apiEnv) {
  return `^|^${Object.entries(apiEnv)
    .map(([name, value]) => `${name}=${value}`)
    .join('|')}`;
}

export function easEnvSpecs(config, apiBaseUrl) {
  return Object.entries({
    ...config.eas.env,
    EXPO_PUBLIC_API_BASE_URL: apiBaseUrl || config.eas.env.EXPO_PUBLIC_API_BASE_URL,
  })
    .filter(([, value]) => isUsableValue(value))
    .map(([name, value]) => ({
      name,
      value,
      visibility: name === 'EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY' ? 'sensitive' : 'plaintext',
    }));
}

function stripInlineComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previous = index > 0 ? value[index - 1] : '';
    if ((char === '"' || char === "'") && previous !== '\\') {
      quote = quote === char ? '' : quote || char;
      continue;
    }
    if (char === '#' && !quote && /\s/.test(previous)) {
      return value.slice(0, index);
    }
  }
  return value;
}

function unquoteValue(value) {
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    const body = value.slice(1, -1);
    return value.startsWith('"') ? body.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : body;
  }
  return value;
}

function requireOptionValue(flag, args) {
  const value = args.shift();
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function valueOrDefault(value, fallback) {
  return isUsableValue(value) ? String(value).trim() : fallback;
}

function valueOrFallback(...values) {
  for (const value of values) {
    if (isUsableValue(value)) {
      return String(value).trim();
    }
  }
  return '';
}

function optionalValue(value) {
  return isUsableValue(value) ? String(value).trim() : undefined;
}

function isUsableValue(value) {
  if (value === undefined || value === null) {
    return false;
  }
  const trimmed = String(value).trim();
  return trimmed !== '' && !PLACEHOLDER_PATTERN.test(trimmed);
}

function assertNoActivePlaceholders(env) {
  const keys = Object.entries(env)
    .filter(([, value]) => String(value ?? '').trim() !== '')
    .filter(([, value]) => PLACEHOLDER_PATTERN.test(String(value).trim()))
    .map(([key]) => key)
    .sort();
  if (keys.length > 0) {
    throw new Error(`Placeholder .env.stage values must be replaced or blanked: ${keys.join(', ')}`);
  }
}

function assertFalse(name, value) {
  if (String(value).trim().toLowerCase() === 'true') {
    throw new Error(`${name}=true is not allowed for real Apple/Kakao staging deploy.`);
  }
}

function compactObject(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
