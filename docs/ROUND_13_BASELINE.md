# Round 13 baseline and recovery record

## Verified starting state

Checked before Round 13 implementation on 2026-11-26/27:

| Item | Verified state |
| --- | --- |
| `origin/main` | `84089f88ff1edddd4776435984c94c0a220e825f` |
| Live production `deployment.json` | `84089f88ff1edddd4776435984c94c0a220e825f` |
| Approved Round 11A branch | `round-11/compactness-refinement` at `7bf997aecab181eb42eef4f35332e5ae4129878a` |
| Round 12 experiment | `round-12/heart-silhouette` at `67323a13f507b51049ef47132c4d76a939235b9f`; not in Adventure Mode |
| Live QA record before retirement | `67323a13f507b51049ef47132c4d76a939235b9f` |
| Active Adventure catalog | Five First Flight levels, `first-flight-r3-compact-weave` |
| Progress schema | v4; content-aware migration, stable IDs, current board state and preferences |
| Production workflow | `pages.yml`, gated on live QA source and workflow records |
| Synchronization workflow | `sync-qa-production.yml`, scheduled every 15 minutes, monitored `round-10/five-level-foundation` |
| Sync variable before Round 13 | `ENABLE_TEMPORARY_PRODUCTION_SYNC=true` |
| QA workflow | QA repository `Deploy QA candidate`, manual full-SHA dispatch |
| Exact state audit limit | 20 arrows / up to 1,048,576 subsets; pairwise blockers use the gameplay simulator |
| Baseline validation | `npm ci`; 125 tests / 17 files passed; `npm run typecheck` passed |

Production was independently confirmed from the live `deployment.json`. The Round 11A revision descends from the production main baseline. No newer source branch superseded the approved Round 11A commit at inspection time. Local tracked changes were absent before the Round 13 branch was created; existing untracked `dist-*` validation output folders were left untouched.

## Recovery points and branch plan

- `checkpoint/round-13-before-production-transition` preserves production `main` at `84089f88ff1edddd4776435984c94c0a220e825f`.
- `round-13/production-transition` starts from the approved Round 11A revision `7bf997aecab181eb42eef4f35332e5ae4129878a`.
- Round 12 remains recoverable at its separate branch and is not cherry-picked into the production branch.

## Workflow retirement actions

Before editing the production workflow, no queued or in-progress sync runs were present. The repository variable was set to `false`, the sync workflow was manually disabled, the QA deployment workflow was manually disabled, and the QA repository's Pages configuration was suspended through the Pages API. The QA repository, workflow definition, historical Actions runs, and source history were retained. The QA root returned HTTP 404 after suspension; a cached metadata endpoint may persist briefly and must not be treated as an active environment.

## Baseline timings and warnings

- `npm ci`: completed in about 9 seconds; zero vulnerabilities. npm emitted a package install-scripts policy warning for `esbuild`; CI's standard `npm ci` successfully installs and validates the project.
- Baseline `npm test`: 125 passing tests across 17 files in 31.44 seconds on this Windows environment.
- Baseline TypeScript validation: passed (`tsc -b --pretty false`).
- The QA deployment run reported a non-blocking GitHub Actions Node.js 20 deprecation notice; no deployment failure was associated with it.

## Solver assumptions to verify

Current gameplay has only static arrows and successful moves remove one whole arrow. For a selected arrow, every other remaining arrow is stationary. The movement simulator checks the moving arrow's complete swept body against each obstacle independently. Round 13 will verify that this pairwise obstruction model is complete and monotonic before using a dependency-graph certificate above the exhaustive subset cap. That certificate will apply only to current removal-only rules; future moving objects, gates, switches, or portals require a separate proof.
