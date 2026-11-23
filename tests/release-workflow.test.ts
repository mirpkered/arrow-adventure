import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const pagesWorkflow = read('../.github/workflows/pages.yml');
const syncWorkflow = read('../.github/workflows/sync-qa-production.yml');
const qaVerifier = read('../scripts/verify-qa-deployment.mjs');
const productionStamp = read('../scripts/stamp-production-build.mjs');

describe('QA-gated production release', () => {
  it('requires the live QA run to have validated the exact production source SHA', () => {
    expect(pagesWorkflow).toContain("qa_sha\" != \"$EXPECTED_SHA\"");
    expect(pagesWorkflow).toContain(".conclusion' <<< \"$run_info\")\" != \"success\"");
    expect(pagesWorkflow).toContain('scripts/verify-qa-deployment.mjs');
    expect(pagesWorkflow).toContain('Confirm QA still serves this exact source revision');
    expect(pagesWorkflow).toContain('npm test && npm run typecheck');
    expect(pagesWorkflow).toContain('npm run build');
    expect(pagesWorkflow).toContain('--base=/arrow-adventure/');
    expect(pagesWorkflow).toContain('qaPanel-*.js');
    expect(pagesWorkflow).toContain('prototypeReview-*.js');
    expect(pagesWorkflow).toContain('prototype-square-true-7');
  });

  it('only synchronizes the configured development head after QA, on a fast-forward', () => {
    expect(syncWorkflow).toContain("cron: '*/15 * * * *'");
    expect(syncWorkflow).toContain("vars.ENABLE_TEMPORARY_PRODUCTION_SYNC == 'true'");
    expect(syncWorkflow).toContain('round-10/five-level-foundation');
    expect(syncWorkflow).toContain("qa_sha\" != \"$source_sha\"");
    expect(syncWorkflow).toContain('npm test && npm run typecheck');
    expect(syncWorkflow).toContain('npm run build -- --base=/arrow-adventure/');
    expect(syncWorkflow).toContain('prototype-square-true-7');
    expect(syncWorkflow).toContain('git merge-base --is-ancestor');
    expect(syncWorkflow).toContain('git push origin "$SOURCE_SHA:refs/heads/main"');
    expect(syncWorkflow).toContain('actions/deploy-pages@v4');
    expect(syncWorkflow).toContain('Confirm QA still serves this exact source revision');
    expect(syncWorkflow).not.toContain('secrets.');
  });

  it('checks live QA source, workflow status, app shell, and required assets', () => {
    for (const check of ['record.sourceCommit !== expectedSha', "run.status !== 'completed'", "run.conclusion !== 'success'", 'site.webmanifest', 'branding/arrow-adventure-official-logo.png', 'branding/mirpworks-logo.jpg', "method: 'HEAD'"]) {
      expect(qaVerifier).toContain(check);
    }
  });

  it('stamps production with the source SHA and both deployment run URLs', () => {
    expect(productionStamp).toContain("environment: 'production'");
    expect(productionStamp).toContain('sourceCommit');
    expect(productionStamp).toContain('qaWorkflowRun');
    expect(productionStamp).toContain('productionWorkflowRun');
  });
});
