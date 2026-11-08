# QA and Production Environments

## Environment layout

| Environment | Repository / branch | Deployment target | Update policy |
| --- | --- | --- | --- |
| Production | `mirpkered/arrow-adventure`, `main` | <https://mirpkered.github.io/arrow-adventure/> | Direct production releases run from `main`; this release is explicitly authorized for production. |
| QA | `mirpkered/arrow-adventure-qa`, workflow on its `main` | <https://mirpkered.github.io/arrow-adventure-qa/> | Manual dispatch with a full candidate SHA from `mirpkered/arrow-adventure`. |
| Feature development | Feature branches in `mirpkered/arrow-adventure` | No automatic deployment | Select a commit explicitly when it is ready for QA. |

The QA repository has its own GitHub Pages project and `github-pages` deployment environment. Its workflow uses the QA repository's `GITHUB_TOKEN`, and its Pages action can publish only to that repository. It has no token, secret, workflow dispatch, or repository write permission in the production repository. Updating or rolling back QA therefore cannot trigger or overwrite production.

```text
selected source commit ──manual dispatch──> QA repo workflow
                                           ├─ checkout exact source SHA
                                           ├─ npm ci, tests, typecheck, QA-base build
                                           ├─ add QA badge and commit metadata
                                           └─ deploy to arrow-adventure-qa Pages

approved source change ──push to main────> arrow-adventure main ──> production Pages
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

The QA workflow sets `VITE_QA_MODE=true` and passes the selected `VITE_CANDIDATE_SHA` at build time. This enables the two-second HUD long-press panel and exposes the candidate SHA in its diagnostics. The production Pages workflow sets neither value, so the QA panel's dynamic chunk is omitted from normal production builds.

Any failed check prevents artifact upload and Pages deployment. The workflow has a single QA concurrency group so overlapping candidate deployments do not race.

## Identifying and reverting QA

The QA page shows a small badge with the first 12 characters of the source SHA. The page's `qa-deployment.json` exposes the full source repository, SHA, and workflow run URL; matching meta tags are also present in `index.html`. The Actions run records the exact candidate input and job logs.

To roll QA back, dispatch the same workflow with the previously deployed source SHA. This creates a new deployment of the earlier source snapshot; it does not force-push or rewrite either repository's history.

## Releasing to production

QA deployment does not promote code. For the current authorized production target, commit and push the selected code to `mirpkered/arrow-adventure` `main`; its Pages workflow validates and builds from that commit. QA artifacts are never copied into production. Keep experiments on feature branches, and do not push them to `main` until the release is ready. Verify the Pages workflow and production URL after each release. A checkpoint branch should be created before replacing a previously deployed game version.

## Paths and browser state

Production builds with `/arrow-adventure/`; QA builds the selected candidate with `/arrow-adventure-qa/`. Vite uses this base for the JavaScript/CSS chunks, title logo, favicon, Apple icon, and manifest. Manifest icon URLs are relative to the manifest URL, so they remain in the matching project path.

Both Pages URLs share the `mirpkered.github.io` origin. The current game has local progress and settings, so it explicitly namespaces storage keys as `arrow-adventure.production.*` and `arrow-adventure.qa.*`; the QA build flag controls the namespace. This keeps QA saves and preferences separate despite the shared origin. There is no service worker or offline cache. If one is added later, cache names must also be environment-specific.

## Current deployment record

- QA repository Pages source: GitHub Actions, independently configured from production.
- Initial QA source: `mirpkered/arrow-adventure@2e46726deca69058e7af8726d60902f937e7eb83`.
- QA workflow run: [41748236896](https://github.com/mirpkered/arrow-adventure-qa/actions/runs/41748236896) (build and deploy succeeded).
- The initial QA deployment record above remains available for rollback. Future QA deployments continue to select a source SHA in the QA repository; production changes deploy independently from `main`.
