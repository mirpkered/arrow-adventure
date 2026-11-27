import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const pagesWorkflow = read('../.github/workflows/pages.yml');
const archivedSync = read('../docs/archive/sync-qa-production.yml');
const productionBuildVerifier = read('../scripts/verify-production-build.mjs');
const productionDeployVerifier = read('../scripts/verify-production-deployment.mjs');
const productionStamp = read('../scripts/stamp-production-build.mjs');

describe('production-only release pipeline', () => {
  it('tests, typechecks, builds, and deploys the exact main revision without consulting QA', () => {
    expect(pagesWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(pagesWorkflow).toContain('ref: ${{ github.sha }}');
    expect(pagesWorkflow).toContain('npm ci');
    expect(pagesWorkflow).toContain('npm test');
    expect(pagesWorkflow).toContain('npm run typecheck');
    expect(pagesWorkflow).toContain('npm run build -- --base=/arrow-adventure/');
    expect(pagesWorkflow).toContain('scripts/verify-production-build.mjs');
    expect(pagesWorkflow).toContain('scripts/stamp-production-build.mjs');
    expect(pagesWorkflow).toContain('actions/upload-pages-artifact@v3');
    expect(pagesWorkflow).toContain('actions/deploy-pages@v4');
    expect(pagesWorkflow).toContain('scripts/verify-production-deployment.mjs');
    expect(pagesWorkflow).not.toContain('arrow-adventure-qa');
    expect(pagesWorkflow).not.toContain('qa-deployment.json');
    expect(pagesWorkflow).not.toContain('QA_WORKFLOW');
  });

  it('keeps the old synchronizer only as inactive historical source', () => {
    expect(existsSync(fileURLToPath(new URL('../.github/workflows/sync-qa-production.yml', import.meta.url)))).toBe(false);
    expect(archivedSync).toContain("cron: '*/15 * * * *'");
    expect(archivedSync).toContain('round-10/five-level-foundation');
  });

  it('stamps production metadata without any QA deployment dependency', () => {
    expect(productionStamp).toContain("environment: 'production'");
    expect(productionStamp).toContain('sourceCommit');
    expect(productionStamp).toContain('productionWorkflowRun');
    expect(productionStamp).not.toContain('qaWorkflowRun');
    expect(productionDeployVerifier).toContain('record.sourceCommit !== expectedSha');
    expect(productionDeployVerifier).toContain("'qaWorkflowRun' in record");
    expect(productionDeployVerifier).toContain('site.webmanifest');
  });

  it('checks production base paths, manifest assets, and excludes developer interfaces and prototypes', () => {
    for (const check of ['/arrow-adventure/', 'prototype-round12-heart', 'prototype-square-true-7', 'prototypeReview-', 'qaPanel-']) {
      expect(productionBuildVerifier).toContain(check);
    }
    expect(productionBuildVerifier).toContain('site.webmanifest');
    expect(productionBuildVerifier).toContain('qaModulesExcluded: true');
  });
});
