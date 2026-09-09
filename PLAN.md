# GOV.UK Design MD delivery plan

This file is the restart-safe source of truth for delivery. Update **Current state**, **Completed**, and **Next action** whenever implementation stops.

## Objective

Publish a community-maintained, AI-readable representation of the GOV.UK Design System that can be installed safely into an existing repository. Canonical guidance stays framework-neutral; adapters cover AI tools, application frameworks, and UI frameworks without duplicating the source material.

## Non-negotiable decisions

- Official GOV.UK guidance and `govuk-frontend` outrank crawler inference.
- Pin both the package release and the reviewed GOV.UK upstream version.
- Keep root `DESIGN.md` concise and route detailed work to focused files.
- Generate Markdown from structured catalog records so content has one source of truth.
- Treat framework and UI-library compatibility as explicit levels, not a blanket guarantee.
- Never silently overwrite local edits during install or update.
- Do not publish the raw extraction bundle, screenshots, fonts, or GOV.UK identity assets in the npm package.
- Keep original project code under MIT and source-derived GOV.UK guidance under OGL v3.0 with attribution.
- State clearly that this is not an official GOV.UK project.

## Delivery phases

### Phase 0 — Product foundations

- [x] Choose working repository identity: `govuk-design-md`.
- [x] Choose working npm identity: `govuk-design-md`; a future maintainer may publish it under a scope.
- [x] Define source precedence, licensing, versioning, and compatibility terminology.
- [x] Record known extraction limitations.

Exit gate: decisions and upstream provenance are committed as repository files.

### Phase 1 — Repository baseline (`v0.1`)

- [x] Add package metadata and npm allow-list.
- [x] Add mixed-license notice and non-official disclaimer.
- [x] Preserve `output/` as historical evidence while excluding it from package publication.
- [x] Add contributor-facing architecture and restart documentation.
- [ ] Rename the remote repository/directory separately; local code must not assume the current misspelled directory name.

Exit gate: `npm pack --dry-run` excludes extraction evidence and the repository can be understood without chat history.

### Phase 2 — Vertical slice (`v0.2`)

Prove the model with Button, Text input, and Accordion.

- [x] Define the component JSON schema.
- [x] Add structured canonical records for the three components.
- [x] Generate component Markdown, `catalog.json`, and root `DESIGN.md` deterministically.
- [x] Add a small, traceable token subset for the slice.
- [x] Add a portable Agent Skill router.
- [x] Add initial `init` and `check` CLI commands.
- [x] Test clean installation, existing `DESIGN.md` preservation, and modification detection.
- [x] Render a browser fixture against `govuk-frontend@6.5.0`, add semantic contract tests, and capture a visual smoke-test artifact.

Exit gate: generation, validation, CLI tests, and npm package inspection all pass.

### Phase 3 — Complete canonical catalog (`v0.3`)

- [x] Add reviewed upstream inventories for 13 styles, 37 components, and 30 patterns, with local parity validation.
- [x] Add all official foundations and brand rules.
- [x] Add every current GOV.UK component and lifecycle status.
- [x] Add every current GOV.UK pattern.
- [x] Add inventory parity tests against a reviewed upstream manifest.
- [x] Add related-item links and component-specific JavaScript contracts.

Exit gate: no framework-specific content exists in canonical records and inventory matches the pinned upstream release.

### Phase 4 — Universal AI integration (`v0.4`)

- [x] Add generated thin adapters for `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, GitHub Copilot, and Cursor.
- [x] Add managed-block conflict handling for existing instruction files.
- [x] Add task-based agent evaluations for component selection, markup fidelity, and non-invention of values.

Exit gate: adapters route to canonical content without copying substantive guidance.

### Phase 5 — Installer and updater (`v0.5`)

- [x] Add `add`, `diff`, `update`, and `uninstall` commands.
- [ ] Add interactive framework and AI selection.
- [x] Add atomic updates and hash-based conflict files.
- [x] Add `DESIGN.local.md` conventions.
- [x] Add a verified curated ZIP builder and GitHub Release attachment workflow.
- [ ] Publish a manual GitHub Release ZIP alongside npm.

Exit gate: upgrade tests prove that local modifications cannot be lost silently.

### Phase 6 — Framework adapters (`v0.7`)

- [x] Plain HTML/CSS reference adapter.
- [ ] React adapter and fixture.
- [ ] Angular adapter and fixture.
- [ ] Svelte adapter and fixture.
- [ ] Astro adapter and fixture.

Exit gate: every adapter documents asset setup, official DOM, server rendering, progressive enhancement, and JavaScript lifecycle.

### Phase 7 — UI-framework adapters (`v0.9`)

- [ ] Tailwind tokens/preset and preflight guidance.
- [ ] shadcn mapping with official-markup fallbacks.
- [ ] Chakra theme mapping and GOV.UK-specific wrappers.
- [ ] Publish a compatibility matrix using `guidance`, `token`, `markup`, and `behaviour-tested` levels.

Exit gate: no adapter claims GOV.UK conformance from theming alone.

### Phase 8 — Automation and stable release (`v1.0`)

- [ ] Scheduled upstream release and inventory checks.
- [ ] Reviewable generated change reports.
- [ ] Schema, link, provenance, installer, upgrade, fixture, accessibility, and visual CI.
- [ ] Release provenance, changelog, and package-size gate.

Exit gate: all current official content is represented, safe install/update paths exist, and upstream changes arrive through reviewed pull requests.

## Current state

- Last updated: 2026-09-09.
- Branch at implementation start: `main`.
- Pinned upstream: `govuk-frontend@6.5.0`.
- Extraction evidence: 101 crawled pages, committed under `output/design-system.service.gov.uk/`.
- Known extraction issues:
  - only five generic component groups were inferred rather than the official component inventory;
  - dark mode is marked supported even though `variableDiff` is empty;
  - the colour reference page is reported as an anomaly because it intentionally demonstrates many palette values.
- Implemented milestone: Phases 0, 2, 3 and 4 plus the local Phase 1 baseline are complete in the working tree; most of Phase 5 and the first Phase 6 adapter are implemented. Publishing and the external repository rename remain separate maintainer actions.
- Canonical catalog: all 13 reviewed styles, 37 components and 30 patterns plus 151 portable tokens. Feedback and Language navigation retain their reviewed Trial status.
- CLI baseline: safe `init`/`add`, `diff`, `update`, `check`, and `uninstall` flows with dry-run support; existing root `DESIGN.md` and user-authored instruction content are preserved.
- Browser fixture: rendered with the exact `govuk-frontend@6.5.0` compiled module; mouse and Enter-key Accordion disclosure were verified with zero browser console errors or warnings on 2026-09-09.
- AI adapter slice: generated routers for five reviewed repository instruction formats; existing shared files use hash-tracked managed blocks and Cursor uses a dedicated package-owned rule.
- Installer/update slice: `add`, `diff`, `update`, `uninstall`, dry runs, atomic update replacement and side-by-side conflict files are implemented without silent replacement of local edits.
- Framework slice: generated Plain HTML/CSS reference guidance records `guidance`, `token`, `markup`, and `behaviour-tested` compatibility and is installed by the CLI with its manifest.
- Manual distribution slice: a clean-install repository overlay, manual merge guidance, release metadata, SHA-256 checksums and automated GitHub Release upload are implemented. Local archive evidence is `release/govuk-design-md-v0.4.0.zip` (161,317 bytes) and is ignored by Git.
- Verification at this checkpoint: `npm run check` passes with 80 inventory entries, 151 tokens, 1 framework adapter, 6 agent evaluation cases, and 24 tests; `npm run pack:check` passes with 120 files and 474,526 bytes unpacked; ZIP integrity and `git diff --check` pass.

## Completed

- Saved the delivery plan in this file.
- Added upstream/source policy and mixed-license documentation.
- Added package metadata, npm publication allow-list, and architecture documentation.
- Added component and source-manifest schemas, reviewed canonical records, and a deterministic Markdown/catalog/token generator.
- Added a portable GOV.UK Agent Skill router.
- Added a non-destructive installer prototype with managed-file hashes and test coverage for clean installs, existing `DESIGN.md`, local modifications, and dry runs.
- Added a pinned GOV.UK Frontend development dependency, served browser fixture, semantic accessibility contract tests, and the visual smoke-test artifact at `output/playwright/vertical-slice.png`.
- Verified that package inspection excludes the large extraction evidence and development fixtures.
- Added reviewed source inventories for all 80 current official style, component, and pattern pages. Local validation checks counts, IDs, URLs, component lifecycle status, canonical-record parity, pinned implementation paths, and the installed GOV.UK Frontend version.
- Added all 13 reviewed foundation/style records and the refreshed GOV.UK Frontend 6.5.0 portable token set.
- Added all 37 reviewed component records with semantic markup, content, accessibility and progressive-enhancement contracts.
- Added all 30 reviewed pattern records with journey rules, safeguards, component relationships and related-pattern links.
- Added generated pattern Markdown, complete machine-readable coverage and catalog parity tests.
- Added a reviewed AI-adapter manifest and generated thin routers for Codex/AGENTS.md, Claude Code, Gemini CLI, GitHub Copilot and Cursor.
- Upgraded the install manifest to schema v2 so `check` distinguishes complete package files from package-owned blocks inside existing user instruction files.
- Added tests proving existing AI instructions survive installation, outside-block edits remain user-owned, managed-block edits are detected and orphaned markers are not silently adopted.
- Added six agent evaluation cases spanning record selection, markup fidelity, progressive enhancement, accessibility and non-invention.
- Added safe add/diff/update/uninstall flows. Updates replace only content still matching its recorded hash, preserve user content around managed blocks and emit `*.govuk-design-md.new` on conflicts.
- Added `DESIGN.local.md` conventions and a user-owned example file; generated AI routers read it when present without adding it to package ownership.
- Added the Plain HTML/CSS reference adapter, schema, manifest, generated page shell, asset/rendering/enhancement/lifecycle contracts, CLI installation and fixture tests.
- Re-verified the reference fixture in a real browser after switching to the official compiled module entry point; pointer and keyboard disclosure behaviour passed with a clean console.
- Installed the attribution notice and both applicable licences inside the namespaced guidance tree so repository installs retain their legal context.
- Added a curated manual-install ZIP builder and release workflow. The builder creates and checks an actual CLI overlay before archiving it, rejects release-tag/package-version mismatches, and includes manual instructions, release metadata and SHA-256 checksums.

## Next action

Continue Phase 6 with the React adapter and fixture, preserving the Plain HTML/CSS DOM and lifecycle contract. Once React is installable, add non-interactive `--framework`/`--ai` selection first and layer prompts only onto interactive terminals. Publishing the npm package, attaching the first ZIP, and renaming the remote remain explicit maintainer actions.

## Resume procedure

1. Read this file and `docs/architecture.md`.
2. Run `git status --short`; preserve unrelated or pre-existing changes.
3. Run `npm install` if `node_modules/` is absent.
4. Run `npm run check`.
5. Run `npm run pack:check` and confirm `output/` and `fixtures/` are absent.
6. Continue from **Next action**.
7. Before stopping, update **Current state**, **Completed**, and **Next action**.

## Definition of done for `v1.0`

- All current official GOV.UK styles, components, patterns, and lifecycle statuses are represented.
- `DESIGN.md` routes agents to focused, traceable guidance.
- One command installs safely into a new or existing repository.
- Updates preserve local modifications and support dry runs and diffs.
- A manual ZIP installation is documented.
- HTML/CSS, React, Angular, Svelte, and Astro adapters are tested.
- Tailwind, shadcn, and Chakra have explicit compatibility mappings.
- Licensing and attribution are correct.
- npm excludes raw extraction evidence and restricted identity assets.
- Upstream changes produce reviewable pull requests.
