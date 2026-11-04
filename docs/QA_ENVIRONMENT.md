# QA and Production Environments

## Environment layout

| Environment | Repository / branch | Deployment target | Update policy |
| --- | --- | --- | --- |
| Production | `mirpkered/arrow-adventure`, `main` | <https://mirpkered.github.io/arrow-adventure/> | Only approved production changes belong on `main`; the production Pages workflow runs from that repository. |
| QA | `mirpkered/arrow-adventure-qa`, workflow on its `main` | <https://mirpkered.github.io/arrow-adventure-qa/> | Manual dispatch with a full candidate SHA from `mirpkered/arrow-adventure`. |
| Feature development | Feature branches in `mirpkered/arrow-adventure` | No automatic deployment | Select a commit explicitly when it is ready for QA. |

The QA repository has its own GitHub Pages project and `github-pages` deployment environment. Its workflow uses the QA repository's `GITHUB_TOKEN`, and its Pages action can publish only to that repository. It has no token, secret, workflow dispatch, or repository write permission in the production repository. Updating or rolling back QA therefore cannot trigger or overwrite production.

```text
selected source commit ──manual dispatch──> QA repo workflow
                                           ├─ checkout exact source SHA
                                           ├─ npm ci, tests, typecheck, QA-base build
                                           ├─ add QA badge and commit metadata
                                           └─ deploy to arrow-adventure-qa Pages

approved source change ──review/merge─────> arrow-adventure main ──> production Pages
```

The QA workflow is [Deploy QA candidate](https://github.com/mirpkered/arrow-adventure-qa/actions/workflows/deploy-qa.yml). Its initial deployment completed in [run 41748236896](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/41748236896) from source commit `2e46726deca69058e7af8726d60902f937e7eb83`.

## Deploying a candidate to QA

Choose a full 40-character commit SHA that is already pushed to `mirpkered/arrow-adventure`. The feature branch itself is never deployed automatically. Dispatch from the QA repository's default branch:

```sh
gh workflow run deploy-qa.yml \
  --repo mirpkered/arrow-adventure-qa \
  --ref main \
  -f candidate_sha=FULL_SOURCE_COMMIT_SHA
```

Or open the QA repository's Actions tab, select **Deploy QA candidate**, and provide the SHA. Before deployment the workflow checks out that exact source commit and requires:

1. `npm ci`
2. `npm test` (including curated catalog structure, stationary geometry, and solver validation)
3. `npm run typecheck`
4. `npm run build -- --base=/arrow-adventure-qa/`

Any failed check prevents artifact upload and Pages deployment. The workflow has a single QA concurrency group so overlapping candidate deployments do not race.

## Identifying and reverting QA

The QA page shows a small badge with the first 12 characters of the source SHA. The page's `qa-deployment.json` exposes the full source repository, SHA, and workflow run URL; matching meta tags are also present in `index.html`. The Actions run records the exact candidate input and job logs.

To roll QA back, dispatch the same workflow with the previously deployed source SHA. This creates a new deployment of the earlier source snapshot; it does not force-push or rewrite either repository's history.

## Promoting an approved release to production

QA deployment does not promote code. After review and approval, merge the selected change to `mirpkered/arrow-adventure` `main` using the repository's release process. The production Pages workflow builds from that repository; QA artifacts are never copied into production. Do not use the production workflow to deploy a feature branch. Confirm the production URL and source branch after an approved release.

## Paths and browser state

Production builds with `/arrow-adventure/`; QA builds the selected candidate with `/arrow-adventure-qa/`. Vite uses this base for the JavaScript/CSS chunks, title logo, favicon, Apple icon, and manifest. Manifest icon URLs are relative to the manifest URL, so they remain in the matching project path.

Both Pages URLs share the `mirpkered.github.io` origin. The current redesigned QA candidate has no local-storage access, no service worker, and no persistent game data, so it cannot read or write the production save key. There is no service-worker cache to share. If persistence or a service worker is added to a future candidate, namespace storage keys and cache names by environment (`qa` versus `production`) and add a regression test before QA deployment; path separation alone does not isolate origin-scoped local storage or Cache Storage.

## Current deployment record

- QA repository Pages source: GitHub Actions, independently configured from production.
- Initial QA source: `mirpkered/arrow-adventure@2e46726deca69058e7af8726d60902f937e7eb83`.
- QA workflow run: [41748236896](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/41748236896) (build and deploy succeeded).
- Production source remains `mirpkered/arrow-adventure` `main`; the QA setup did not write to that repository or invoke its workflow.
