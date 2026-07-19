#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
  artifactImageUri,
  buildStageConfig,
  cloudRunEnvMapping,
  cloudRunSecretMapping,
  createSecretSpecs,
  deriveDirectDatabaseUrl,
  easEnvSpecs,
  legacyCloudRunEnvNames,
  notificationWorkerEnvMapping,
  notificationWorkerRunUri,
  notificationWorkerSecretMapping,
  parseDeployArgs,
  readDotenvFile,
  resolvePublicEndpoints,
} from './deploy-env.mjs';

const STAGE_ENV_PATH = '.env.stage';

async function main() {
  const options = parseDeployArgs(process.argv.slice(2));
  if (!existsSync(STAGE_ENV_PATH)) {
    throw new Error(`Missing ${STAGE_ENV_PATH}. Create it with: cp .env.stage.example .env.stage`);
  }

  let config = buildStageConfig({ env: readDotenvFile(STAGE_ENV_PATH) });
  let runner = new CommandRunner({ dryRun: options.dryRun, sensitiveValues: collectSensitiveValues(config) });

  console.log(`Deploy target: stage (${config.gcp.projectId}/${config.gcp.region}, branch ${config.deploy.branch})`);
  if (options.dryRun) {
    console.log('Dry run: commands will be printed but not executed.');
  }

  let cloudRunUrl = config.eas.env.EXPO_PUBLIC_API_BASE_URL;
  if (shouldResolvePublicEndpoints(options.only)) {
    cloudRunUrl ||= getCloudRunUrl(runner, config);
    config = resolvePublicEndpoints(config, cloudRunUrl);
    runner = new CommandRunner({ dryRun: options.dryRun, sensitiveValues: collectSensitiveValues(config) });
  }

  if (shouldRun(options.only, 'secrets')) {
    syncSecretManager(runner, config);
  }

  if (shouldRun(options.only, 'api-env')) {
    updateCloudRunEnvironment(runner, config);
  }

  if (shouldRun(options.only, 'db')) {
    runDatabaseMigration(runner, config);
  }

  if (shouldRun(options.only, 'api-deploy')) {
    deployApi(runner, config);
  }

  if (shouldRun(options.only, 'notification-worker')) {
    deployNotificationWorker(runner, config);
  }

  if (shouldRun(options.only, 'smoke')) {
    smokeCloudRun(runner, cloudRunUrl);
  }

  if (shouldRun(options.only, 'eas-env')) {
    syncEasEnvironment(runner, config, cloudRunUrl);
  }

  if (shouldRun(options.only, 'mobile-build') && options.platform !== 'none') {
    buildMobile(runner, config, options);
  }

  console.log('Deploy stage flow finished.');
}

function syncSecretManager(runner, config) {
  for (const spec of createSecretSpecs(config)) {
    console.log(`Sync Secret Manager: ${spec.secretName} -> Cloud Run ${spec.envName}`);
    const describe = runner.run('gcloud', ['secrets', 'describe', spec.secretName, '--project', config.gcp.projectId], {
      allowFailure: true,
      quiet: true,
    });
    if (describe.status !== 0) {
      runner.run('gcloud', [
        'secrets',
        'create',
        spec.secretName,
        '--project',
        config.gcp.projectId,
        '--replication-policy=automatic',
      ]);
    }
    runner.run(
      'gcloud',
      ['secrets', 'versions', 'add', spec.secretName, '--project', config.gcp.projectId, '--data-file=-'],
      { input: spec.value },
    );
    runner.run('gcloud', [
      'secrets',
      'add-iam-policy-binding',
      spec.secretName,
      '--project',
      config.gcp.projectId,
      `--member=serviceAccount:${config.gcp.runtimeServiceAccount}`,
      '--role=roles/secretmanager.secretAccessor',
    ]);
  }
}

function updateCloudRunEnvironment(runner, config) {
  console.log(`Update Cloud Run env/secret refs: ${config.cloudRun.service}`);
  const args = [
    'run',
    'services',
    'update',
    config.cloudRun.service,
    '--project',
    config.gcp.projectId,
    '--region',
    config.gcp.region,
    `--update-secrets=${cloudRunSecretMapping(config)}`,
    `--update-env-vars=${cloudRunEnvMapping(config.apiEnv)}`,
  ];
  args.push(`--remove-env-vars=${legacyCloudRunEnvNames().join(',')}`);
  runner.run('gcloud', args);
}

function runDatabaseMigration(runner, config) {
  console.log('Run staging DB migration with configured database URL.');
  runner.run('pnpm', ['db:migrate'], {
    env: { ...process.env, DATABASE_URL: deriveDirectDatabaseUrl(config.secrets.DATABASE_URL) },
  });
}

function deployApi(runner, config) {
  console.log(`Run Cloud Build trigger: ${config.cloudBuild.trigger}`);
  runner.run('gcloud', [
    'builds',
    'triggers',
    'run',
    config.cloudBuild.trigger,
    '--project',
    config.gcp.projectId,
    '--region',
    config.gcp.cloudBuildRegion,
    `--branch=${config.deploy.branch}`,
  ]);
}

function deployNotificationWorker(runner, config) {
  ensureNotificationWorkerSchedulerIdentity(runner, config);
  upsertNotificationWorkerJob(runner, config);
  upsertNotificationWorkerScheduler(runner, config);
}

function ensureNotificationWorkerSchedulerIdentity(runner, config) {
  const schedulerServiceAccount = config.notificationWorker.schedulerServiceAccount;
  const accountId = serviceAccountIdForProject(schedulerServiceAccount, config.gcp.projectId);
  if (accountId) {
    const describe = runner.run(
      'gcloud',
      ['iam', 'service-accounts', 'describe', schedulerServiceAccount, '--project', config.gcp.projectId],
      { allowFailure: true, quiet: true },
    );
    if (describe.status !== 0) {
      runner.run('gcloud', [
        'iam',
        'service-accounts',
        'create',
        accountId,
        '--project',
        config.gcp.projectId,
        '--display-name',
        'i-um notification worker scheduler',
      ]);
    }
  }

  runner.run('gcloud', ['services', 'enable', 'cloudscheduler.googleapis.com', 'run.googleapis.com', '--project', config.gcp.projectId]);
  runner.run('gcloud', [
    'projects',
    'add-iam-policy-binding',
    config.gcp.projectId,
    `--member=serviceAccount:${schedulerServiceAccount}`,
    '--role=roles/run.developer',
  ]);
}

function upsertNotificationWorkerJob(runner, config) {
  const jobName = config.notificationWorker.jobName;
  const image = artifactImageUri(config);
  const commonArgs = [
    `--image=${image}`,
    `--region=${config.gcp.region}`,
    `--service-account=${config.gcp.runtimeServiceAccount}`,
    '--command=/app/notification-worker',
    `--set-secrets=${notificationWorkerSecretMapping(config)}`,
    `--set-env-vars=${notificationWorkerEnvMapping(config)}`,
    '--tasks=1',
    '--max-retries=0',
    '--task-timeout=600s',
    '--quiet',
  ];

  const describe = runner.run(
    'gcloud',
    ['run', 'jobs', 'describe', jobName, '--project', config.gcp.projectId, '--region', config.gcp.region],
    { allowFailure: true, quiet: true },
  );
  if (describe.status === 0) {
    console.log(`Update notification worker Cloud Run Job: ${jobName}`);
    runner.run('gcloud', ['run', 'jobs', 'update', jobName, '--project', config.gcp.projectId, ...commonArgs]);
    return;
  }

  console.log(`Create notification worker Cloud Run Job: ${jobName}`);
  runner.run('gcloud', ['run', 'jobs', 'create', jobName, '--project', config.gcp.projectId, ...commonArgs]);
}

function upsertNotificationWorkerScheduler(runner, config) {
  const schedulerJobName = config.notificationWorker.schedulerJobName;
  const commonArgs = [
    `--location=${config.gcp.region}`,
    `--schedule=${config.notificationWorker.schedule}`,
    `--time-zone=${config.notificationWorker.timeZone}`,
    `--uri=${notificationWorkerRunUri(config)}`,
    '--http-method=POST',
    '--message-body={}',
    '--headers=Content-Type=application/json',
    `--oauth-service-account-email=${config.notificationWorker.schedulerServiceAccount}`,
    '--oauth-token-scope=https://www.googleapis.com/auth/cloud-platform',
  ];

  const describe = runner.run(
    'gcloud',
    ['scheduler', 'jobs', 'describe', schedulerJobName, '--project', config.gcp.projectId, '--location', config.gcp.region],
    { allowFailure: true, quiet: true },
  );
  if (describe.status === 0) {
    console.log(`Update notification worker Cloud Scheduler job: ${schedulerJobName}`);
    runner.run('gcloud', ['scheduler', 'jobs', 'update', 'http', schedulerJobName, '--project', config.gcp.projectId, ...commonArgs]);
    return;
  }

  console.log(`Create notification worker Cloud Scheduler job: ${schedulerJobName}`);
  runner.run('gcloud', ['scheduler', 'jobs', 'create', 'http', schedulerJobName, '--project', config.gcp.projectId, ...commonArgs]);
}

function serviceAccountIdForProject(email, projectId) {
  const suffix = `@${projectId}.iam.gserviceaccount.com`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : null;
}

function getCloudRunUrl(runner, config) {
  const result = runner.run('gcloud', [
    'run',
    'services',
    'describe',
    config.cloudRun.service,
    '--project',
    config.gcp.projectId,
    '--region',
    config.gcp.region,
    '--format=value(status.url)',
  ]);
  const value = result.stdout.trim();
  if (value) {
    console.log(`Cloud Run URL: ${value}`);
  }
  return value || 'https://cloud-run-url-after-deploy.example';
}

function smokeCloudRun(runner, cloudRunUrl) {
  if (!cloudRunUrl) {
    throw new Error('Cloud Run URL is required for smoke checks.');
  }
  console.log('Smoke check Cloud Run /health and /ready.');
  runner.run('curl', ['--fail', '--show-error', '--silent', '--retry', '5', '--retry-delay', '5', `${cloudRunUrl}/health`]);
  runner.run('curl', ['--fail', '--show-error', '--silent', '--retry', '5', '--retry-delay', '5', `${cloudRunUrl}/ready`]);
}

function syncEasEnvironment(runner, config, cloudRunUrl) {
  console.log(`Sync EAS ${config.eas.environment} environment.`);
  for (const spec of easEnvSpecs(config, cloudRunUrl)) {
    runner.run(
      'pnpm',
      [
        'dlx',
        'eas-cli@latest',
        'env:create',
        config.eas.environment,
        '--name',
        spec.name,
        '--value',
        spec.value,
        '--visibility',
        spec.visibility,
        '--force',
        '--non-interactive',
      ],
      { cwd: config.eas.projectDir },
    );
  }
}

function buildMobile(runner, config, options) {
  console.log(`Start EAS internal build: profile=${config.eas.buildProfile} platform=${options.platform}`);
  runner.run(
    'pnpm',
    [
      'dlx',
      'eas-cli@latest',
      'build',
      '--profile',
      config.eas.buildProfile,
      '--platform',
      options.platform,
      options.wait ? '--wait' : '--no-wait',
    ],
    { cwd: config.eas.projectDir, interactive: true },
  );
}

function shouldResolvePublicEndpoints(only) {
  return only !== 'db' && only !== 'notifications';
}

function shouldRun(only, step) {
  if (only === 'all') {
    return true;
  }
  const groups = {
    api: new Set(['secrets', 'api-env', 'db', 'api-deploy', 'notification-worker', 'smoke']),
    mobile: new Set(['eas-env', 'mobile-build']),
    secrets: new Set(['secrets', 'api-env']),
    db: new Set(['db']),
    smoke: new Set(['smoke']),
    'eas-env': new Set(['eas-env']),
    notifications: new Set(['secrets', 'notification-worker']),
  };
  return groups[only]?.has(step) ?? false;
}

function collectSensitiveValues(config) {
  return [
    ...Object.values(config.secrets),
    config.eas.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY,
    config.eas.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
    deriveDirectDatabaseUrl(config.secrets.DATABASE_URL),
  ].filter(Boolean);
}

class CommandRunner {
  constructor({ dryRun, sensitiveValues }) {
    this.dryRun = dryRun;
    this.sensitiveValues = sensitiveValues;
  }

  run(command, args, options = {}) {
    const display = formatCommand(command, args);
    if (!options.quiet) {
      console.log(`$ ${display}`);
    }
    if (this.dryRun) {
      return { status: 0, stdout: '', stderr: '' };
    }

    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      input: options.input,
      encoding: 'utf8',
      stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    });

    if (options.interactive) {
      if (result.status !== 0) {
        throw new Error(`Command failed (${result.status ?? 'signal'}): ${display}`);
      }
      return { status: result.status ?? 0, stdout: '', stderr: '' };
    }

    const stdout = redact(result.stdout ?? '', this.sensitiveValues);
    const stderr = redact(result.stderr ?? '', this.sensitiveValues);
    if (!options.quiet && stdout) {
      process.stdout.write(stdout);
    }
    if (!options.quiet && stderr) {
      process.stderr.write(stderr);
    }

    const status = result.status ?? 1;
    if (status !== 0 && !options.allowFailure) {
      throw new Error(`Command failed (${status}): ${display}`);
    }
    return { status, stdout, stderr };
  }
}

function formatCommand(command, args) {
  const maskedArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--value') {
      maskedArgs.push(arg, '<redacted>');
      index += 1;
      continue;
    }
    maskedArgs.push(arg);
  }
  return [command, ...maskedArgs].map(shellQuote).join(' ');
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@,+-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function redact(text, sensitiveValues) {
  let output = text;
  for (const value of sensitiveValues) {
    if (value) {
      output = output.split(value).join('<redacted>');
    }
  }
  return output;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
