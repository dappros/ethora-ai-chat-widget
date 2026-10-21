# Workflow: branches, commits, local CI, releases

This repository publishes `@ethora/ai-chat-widget` to npm and attaches the embeddable bundle to each GitHub release.

## Branches

Two long-lived branches:

- `main`: released code. Every npm release is cut from here.
- `dev`: integration. Work lands here first.

Work branches use `<type>/<name>`, where `<name>` is lowercase words joined by hyphens:

| Type | Use |
|---|---|
| `feat/` | new functionality |
| `fix/` | bug fix |
| `hotfix/` | urgent fix; still goes through `dev` |
| `chore/` | tooling, dependencies, release plumbing |
| `docs/` | documentation only |
| `refactor/` | code change without behaviour change |
| `test/` | tests only |
| `perf/` | performance |
| `ci/` | CI configuration |
| `build/` | build system |
| `revert/` | revert of an earlier change |

Examples: `feat/room-search`, `fix/unread-counter-reset`, `chore/release-flow`.

Release lines are named with four digits, `YYMM` (for example `2610`). Other names are not allowed for new branches.

Branches that already exist are not renamed. The naming rule applies when a new branch is first pushed.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`.

Keep each fix in its own commit. Do not mix a fix with a refactor or a feature.

## Flow

1. Start from `dev`: `git switch -c feat/room-search dev`
2. Commit on the work branch.
3. Merge into `dev` locally: `git switch dev && git merge --no-ff feat/room-search`
4. Push: `git push origin dev`. The `pre-push` hook runs `npm run ci:local` first and aborts the push if it fails.
5. When `dev` is ready for release: `git switch main && git merge --no-ff dev && git push origin main`. The server CI (GitHub Actions) runs on the push to `main`. It also runs on every pull request into `main` or `dev`.
6. Release from `main` (see below).

Do not merge pull requests into `dev` from the GitHub web UI. The local gate in step 4 is what protects `dev`, and it does not run for web merges.

Set up the hooks once per clone with `npm install`. This sets `core.hooksPath` to `.githooks/`.

## Local CI

```bash
npm run ci:local
```

Runs lint, the attribute contract, the type check and the release-script checks. It does not build: the widget bundle compiles chat-component from `../ethora-chat-component`, and the server builds it with the ref pinned in `chat-component.ref`.

## Server CI

`.github/workflows/ci.yml` runs on pull requests into `main` or `dev` (drafts are skipped), on pushes to `main` and by hand. Steps: install, lint, attribute contract, type check, release-script and changelog checks, the readable build, the bundle check and a check of the npm package contents. The built `dist` is uploaded as the `widget-dist` artifact (7 days) so a pull request can be tested without building it.

The type check is a ratchet: `tsc` reports 11 errors today (chat-component subpath imports the published package does not map for types), recorded in `scripts/typecheck-baseline.json`. The step fails when the count goes up. When you fix some, run `node scripts/check-types.mjs --update` and commit the lower number.

A manual run takes an optional `chat_component_ref` to build against another chat-component branch, tag or commit.

## Versions and releases

Versions are the UTC date written as `yy.m.d` with no leading zeros, for example `26.10.14`. npm rejects `26.10.01`.

- If today's version is newer than the current version (the higher of `package.json` and npm), the release uses today's date.
- If today's version is not newer (a second release on the same day), the release uses the next day: `26.9.26` becomes `26.9.27`.
- An explicit version must be newer than what is on npm and must not be published yet.
- Future dates are allowed.

Tags are `v` plus the version, for example `v26.10.14`.

Plan a release (changes nothing):

```bash
npm run release
```

Cut a release from `main` (commit and tag locally):

```bash
npm run release -- --yes
```

Cut and publish in one step (the tag push starts the publish workflow):

```bash
npm run release -- --yes --push
```

Or run the **Release** workflow by hand in GitHub Actions (Actions > Release > Run workflow). It bumps and tags `main`, then publishes.

### What a release does

1. The version bump writes `package.json` and `package-lock.json` and moves everything under `## [Unreleased]` in `CHANGELOG.md` into `## [<version>] - <date>`. An empty Unreleased gets the line "No notable changes." Write the entries while you work, one line per change.
2. The `verify` job checks that the tag matches `package.json`, that the version is not on npm yet, that it is newer than the latest version and that the tag points at `origin/main`. It runs the CI checks, builds the readable bundle, checks the bundle and the package contents, and runs `npm publish --dry-run`.
3. The `publish` job (environment `npm-release`) takes the verified build, so nothing is rebuilt. It runs `npm publish --provenance --access public` (secret `NPM_TOKEN`, or npm trusted publishing) and creates the GitHub release for the tag with these assets: `ethora_assistant.js`, `pdf.min.mjs`, `pdf.worker.min.mjs` and `SHA256SUMS`. The release notes are the `CHANGELOG.md` section plus the chat-component commit the bundle was built from.
4. The `notify-wordpress` job starts the plugin update (see below).

Re-running failed jobs is safe: a version that is already on npm is skipped, and an existing release gets its assets replaced.

### Dry run

Actions > Release > Run workflow, tick `dry_run`. It rehearses the version bump on the runner, runs all checks and the build, and does `npm publish --dry-run`. It pushes nothing, publishes nothing and creates no release. Locally, `npm run release` (without `--yes`) prints the plan and changes nothing.

### Setup, once

- Secret `NPM_TOKEN`: an npm automation token that can publish `@ethora/ai-chat-widget`. Not needed if the package is configured for npm trusted publishing (repository `dappros/ethora-ai-chat-widget`, workflow `release.yml`).
- Environment `npm-release`, with required reviewers if you want an approval step.
- Secret `WP_REPO_TOKEN` (optional): starts the plugin update. See below.
- The manual run pushes the release commit and the tag to `main` with the workflow token. If `main` is protected, allow the GitHub Actions app to bypass the rule, or release from your terminal with `npm run release -- --yes --push`.

## Widget specifics

- `chat-component.ref` pins the `@ethora/chat-component` ref that the bundle is built from. Changing it changes what ships, so change it in its own commit and say why in the message.
- Local builds use whatever is checked out in the sibling `../ethora-chat-component`. That is not reproducible, which is why the build is not part of `ci:local`.
- The bundle is built with `--minify false` because the WordPress.org review requires readable JavaScript.
- `npm run typecheck` still reports errors from `@ethora/chat-component` subpath imports that do not resolve for types from the published package (its `exports` map has no extension mapping). The gate is the ratchet `npm run check:types`, see Server CI.
- `dist/ethora_assistant.js` is tracked in git so that git installs keep working. A release does not commit a rebuilt bundle to `main`; the npm package and the GitHub release carry the built one.
- `chat-component.ref` is a branch name (`main`) today, so every build takes the latest chat-component `main`. The release notes record the exact commit. Put a commit hash in the file to pin the build.

## Release from your terminal (no npm login)

```bash
npm run release:ci              # next version: the day after the current one
npm run release:ci -- 26.10.20  # or an explicit version
```

This starts the Release workflow on GitHub Actions with the GitHub CLI. The publish runs in CI with the `NPM_TOKEN` secret, and it attaches the readable bundle `ethora_assistant.js` to the GitHub release.

## Handing the bundle to the WordPress plugin

The WordPress plugin ships the bundle from a widget release. After a release (for example `v26.10.1`) the plugin is updated in two steps.

1. The release workflow starts the plugin repository's *Update the bundled widget* workflow when this repository has the `WP_REPO_TOKEN` secret. That secret is a fine-grained token for `dappros/ethora-wp-plugin` with the repository permission Actions: read and write (it only needs to start a workflow there). Without the secret, start it by hand:

   ```bash
   gh workflow run update-widget.yml -R dappros/ethora-wp-plugin -f widget_tag=v26.10.1
   ```

   It opens a pull request there with the new bundle and the pdf.js files from the release, the plugin version and a changelog line. It never publishes.

2. Merging that pull request publishes the plugin to WordPress.org through the plugin's *Publish to WordPress.org* workflow (after the approval in its `wordpress-org` environment). The steps, the dry runs and the secrets are in `.github/RELEASING.md` and `.github/PUBLISHING.md` of the plugin repository.

The plugin version is SemVer `1.x.y`, separate from the widget version.
