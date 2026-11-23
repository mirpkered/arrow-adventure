# QA and Production Environments

## Environment layout

| Environment | Repository / branch | Deployment target | Update policy |
| --- | --- | --- | --- |
| Production | `mirpkered/arrow-adventure`, `main` | <https://mirpkered.github.io/arrow-adventure/> | Temporary sync promotes only the latest development-branch SHA after that exact revision succeeds and deploys on QA. |
| QA | `mirpkered/arrow-adventure-qa`, workflow on its `main` | <https://mirpkered.github.io/arrow-adventure-qa/> | Manual dispatch with a full candidate SHA from `mirpkered/arrow-adventure`. |
| Development candidate | `round-10/five-level-foundation` in `mirpkered/arrow-adventure` | QA, then production after a successful QA record | Experimental work stays on other branches. Only a fast-forward candidate from this branch can synchronize. |

The QA repository has its own GitHub Pages project and `github-pages` deployment environment. Its workflow uses the QA repository's `GITHUB_TOKEN`, and its Pages action can publish only to that repository. It has no token, secret, workflow dispatch, or repository write permission in the production repository. Updating or rolling back QA therefore cannot trigger or overwrite production.

```text
selected source commit ──manual dispatch──> QA repo workflow
                                           ├─ checkout exact source SHA
                                           ├─ npm ci, tests, typecheck, QA-base build
                                           ├─ add QA badge and commit metadata
                                           └─ deploy to arrow-adventure-qa Pages

developer-approved release ──push to main────> arrow-adventure main ──> production Pages
```

The QA workflow is [Deploy QA candidate](https://github.com/mirpkered/arrow-adventure-qa/actions/workflows/deploy-qa.yml). Its initial deployment completed in [run 41748236896](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/41748236896) from source commit `2e46726deca69058e7af8726d60902f937e7eb83`.

## Temporary QA-to-production synchronization

The source workflow is [Sync QA-approved development to production](https://github.com/mirpkered/arrow-adventure/actions/workflows/sync-qa-production.yml). QA remains an independent Pages site and requires an explicit full-SHA dispatch. After the QA workflow succeeds and its live `qa-deployment.json` reports the latest commit on `round-10/five-level-foundation`, the source repository's 15-minute scheduled check:

1. Confirms the QA source SHA and successful QA Actions run.
2. Checks the live QA page, JavaScript, CSS, manifest, logo, and app icon responses.
3. Re-runs the full tests and TypeScript validation against that exact revision.
4. Makes a separate production build at `/arrow-adventure/`, verifies QA-only modules were tree-shaken, and writes a production `deployment.json` source/run record.
5. Fast-forwards `main` only if the candidate descends from its current head, then deploys the production artifact.

QA and production are built separately from the same SHA; the QA artifact is never copied into production. No cross-repository credential or additional secret is required. The source workflow uses its repository-scoped `GITHUB_TOKEN` to update `main`, then deploys its own artifact. GitHub suppresses push-triggered workflows for that token, avoiding a deployment loop. The ordinary `pages.yml` workflow also refuses a main-branch deployment unless QA reports that exact SHA and its workflow succeeded.

Disable the temporary automation before public launch by setting the source repository Actions variable `ENABLE_TEMPORARY_PRODUCTION_SYNC` to `false` or removing it. The sync workflow then stops promoting candidates. Explicit later releases can still use `pages.yml` after deploying the same SHA to QA.

For routine updates, commit finished gameplay to `round-10/five-level-foundation`, dispatch **Deploy QA candidate** with its exact SHA, and wait for the QA Pages deployment. The synchronizer promotes it on its next 15-minute poll. **Run workflow** on the sync action can check immediately; it safely skips if the current branch head is not yet deployed on QA.

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

The QA workflow sets `VITE_QA_MODE=true` and passes the selected `VITE_CANDIDATE_SHA` at build time. This enables the two-second HUD long-press panel and exposes the candidate SHA in its diagnostics. Production sets neither value, and its workflows fail if `qaPanel` or `prototypeReview` chunks appear.

Any failed check prevents artifact upload and Pages deployment. The workflow has a single QA concurrency group so overlapping candidate deployments do not race.

## Identifying and reverting QA

The QA page shows a small badge with the first 12 characters of the source SHA. The page's `qa-deployment.json` exposes the full source repository, SHA, and workflow run URL; matching meta tags are also present in `index.html`. The Actions run records the exact candidate input and job logs.

To roll QA back, dispatch the same workflow with the previously deployed source SHA. This creates a new deployment of the earlier source snapshot; it does not force-push or rewrite either repository's history.

## Releasing to production

During the temporary sync period, QA deployment of the configured development-branch head is the routine release gate; no second approval is required. Other feature branches are never considered. After synchronization is disabled, explicitly deploy the selected SHA to QA and fast-forward `main` to that same SHA; `pages.yml` will validate and deploy it. QA artifacts are never copied into production. Create a recoverable checkpoint before replacing a deployed game version.

## Paths and browser state

Production builds with `/arrow-adventure/`; QA builds the selected candidate with `/arrow-adventure-qa/`. Vite uses this base for the JavaScript/CSS chunks, title logo, favicon, Apple icon, and manifest. Manifest icon URLs are relative to the manifest URL, so they remain in the matching project path.

Both Pages URLs share the `mirpkered.github.io` origin. The game namespaces local progress and settings as `arrow-adventure.production.*` and `arrow-adventure.qa.*`; the QA build flag controls the namespace. Round 10 progress is schema v3, and startup retires old Adventure game keys without removing appearance/audio preferences. This keeps QA saves and preferences separate despite the shared origin. There is no service worker or offline cache. If one is added later, cache names must also be environment-specific.

## Deployment history and live record

- QA repository Pages source: GitHub Actions, independently configured from production.
- Initial QA source: `mirpkered/arrow-adventure@2e46726deca69058e7af8726d60902f937e7eb83`.
- QA workflow run: [41748236896](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/41748236896) (build and deploy succeeded).
- Before the Round 9H interactive review rollout, the live QA record identified source `6ab53db3770e3ca4f975818ea7dd26f5f29383c2` and [workflow run 42911906151](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/42911906151).
- The live source SHA and workflow URL are exposed by `https://mirpkered.github.io/arrow-adventure-qa/qa-deployment.json`; that endpoint and the QA repository's Actions history are authoritative for the current deployment. Historical source SHAs remain available for rollback.
- Production exposes its deployed source SHA and QA/production workflow URLs at `https://mirpkered.github.io/arrow-adventure/deployment.json` after Round 10 synchronization.
