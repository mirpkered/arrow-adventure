# Production release and paused QA environment

## Current release model

Arrow Adventure is in prelaunch development. The production site is the current playtest environment:

- Production repository: [`mirpkered/arrow-adventure`](https://github.com/mirpkered/arrow-adventure)
- Production branch/site: `main` → <https://mirpkered.github.io/arrow-adventure/>
- Production base path: `/arrow-adventure/`
- Separate QA repository: [`mirpkered/arrow-adventure-qa`](https://github.com/mirpkered/arrow-adventure-qa), retained but paused.

Feature work stays on a named development branch. After the candidate passes the full automated gate, create a release checkpoint, fast-forward or safely merge it into `main`, and let `pages.yml` build and deploy that exact main SHA. The release workflow installs the lockfile, runs the full test suite and TypeScript validation, builds the production path, verifies that developer tools and experimental prototypes are excluded, writes `deployment.json`, deploys GitHub Pages, and checks the live record, app shell, manifest, icons, and branding assets. The public deployment record identifies the source SHA and production workflow run.

The deployment workflow has no dependency on `arrow-adventure-qa`, `qa-deployment.json`, or a QA run URL. Production uses its own local-storage namespace and no QA data is imported.

## QA retirement state

Round 13 intentionally paused the previous QA environment before changing production release behavior:

- `ENABLE_TEMPORARY_PRODUCTION_SYNC` is `false`.
- The source repository's `Sync QA-approved development to production` workflow is manually disabled and archived at [`docs/archive/sync-qa-production.yml`](archive/sync-qa-production.yml). Its old schedule and monitored Round 10 branch are retained for history only.
- No queued or active synchronization run remained at retirement.
- The QA repository's `Deploy QA candidate` workflow is manually disabled; its source and past Actions runs remain in that repository.
- The QA repository's GitHub Pages configuration was suspended. The QA root now returns 404 and must not be used as the current test environment. A stale `qa-deployment.json` may remain briefly in edge cache; it is historical metadata only.
- The QA repository itself has not been deleted. Its source, release workflow, settings, and history can support reintroduction.

## Production release procedure

1. Fetch the latest `main` and development branch; inspect unrelated changes before integrating.
2. Push the finished candidate to its development branch and run `npm ci`, `npm test`, `npm run typecheck`, `npm run build -- --base=/arrow-adventure/`, and `git diff --check`.
3. Run any catalog/geometry audit command introduced for the candidate and inspect generated previews.
4. Create a named checkpoint at the current production `main` SHA.
5. Fast-forward `main` to the validated candidate; do not force-push.
6. Wait for [Validate and deploy production](https://github.com/mirpkered/arrow-adventure/actions/workflows/pages.yml) to finish successfully.
7. Confirm `https://mirpkered.github.io/arrow-adventure/deployment.json` reports the promoted SHA and current workflow run; verify the page and required assets return HTTP 200.
8. Revert by preparing a new commit that restores the checkpoint content, then deploy normally. Do not rewrite published history.

Only commits on `main` deploy automatically. A failed test, typecheck, build, artifact check, or live verification blocks a successful release. `workflow_dispatch` is limited to `main` and builds that exact SHA.

## Restore QA later

When a separate review environment is useful again:

1. Re-enable the QA repository's `Deploy QA candidate` workflow in GitHub Actions.
2. Recreate its Pages configuration with **GitHub Actions** as the build source in the QA repository settings.
3. Dispatch its workflow with a full source SHA and its intended `/arrow-adventure-qa/` build path.
4. Re-enable and document only the deliberate review/release policy required at that time. Do not restore the old scheduled production synchronizer; the current production workflow is intentionally standalone.
5. Confirm production and QA local-storage keys remain distinct because GitHub Pages project paths share the same origin.

The QA deployment repository and source workflow remain recoverable; there is no need to restore from a backup or alter production `main` merely to bring QA back.

## Historical architecture

Before Round 13, production required an exact QA deployment record and a scheduled source workflow promoted `round-10/five-level-foundation`. Those paths were retired after Round 11A was approved. Their configuration is preserved in Git history and the archived workflow file for auditability. Historical QA deployments and the Round 12 heart prototype are not current production content.
