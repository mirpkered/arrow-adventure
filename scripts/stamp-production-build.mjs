import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [outputDirectory, sourceCommit, productionWorkflowRun] = process.argv.slice(2);
if (!outputDirectory || !/^[0-9a-f]{40}$/.test(sourceCommit ?? '')
  || !/^https:\/\/github\.com\/mirpkered\/arrow-adventure\/actions\/runs\/\d+$/.test(productionWorkflowRun ?? '')) {
  throw new Error('Usage: node scripts/stamp-production-build.mjs <dist> <40-char-source-sha> <production-run-url>');
}

const record = {
  environment: 'production',
  sourceRepository: 'mirpkered/arrow-adventure',
  sourceCommit,
  productionWorkflowRun,
};
writeFileSync(resolve(outputDirectory, 'deployment.json'), `${JSON.stringify(record, null, 2)}\n`);
