import { auditedContrastPairs, runContrastAudit } from './contrast-audit';

const result = runContrastAudit(auditedContrastPairs);

for (const entry of [...result.passes, ...result.failures]) {
  const status = entry.ratio >= entry.minimumRatio ? 'PASS' : 'FAIL';
  console.log(`${status} ${entry.name}: ${entry.ratio.toFixed(2)} >= ${entry.minimumRatio}`);
}

if (result.failures.length > 0) {
  console.error(`Mobile contrast audit failed: ${result.failures.length} token pair(s) below threshold.`);
  throw new Error('Mobile contrast audit failed.');
} else {
  console.log(`Mobile contrast audit passed: ${result.passes.length} token pair(s) checked.`);
}
