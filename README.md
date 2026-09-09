# GOV.UK Design MD

Installable, AI-readable guidance for building services with the GOV.UK Design System.

> This community project is not affiliated with or endorsed by the UK Government, the Government Digital Service, or the GOV.UK Design System team.

## Project status

The framework-neutral canonical catalog is complete for the reviewed GOV.UK Design System baseline:

- 13 of 13 foundations and styles
- 37 of 37 components, including explicit Trial status
- 30 of 30 user-centred patterns
- 151 portable design tokens

Generated instruction adapters cover Codex and other `AGENTS.md` consumers, Claude Code, Gemini CLI, GitHub Copilot and Cursor. The package also includes task-based agent evaluations, conflict-safe install/update flows and a behaviour-tested Plain HTML/CSS reference adapter. React, Angular, Svelte, Astro and UI-framework adapters remain planned. See [PLAN.md](PLAN.md) for delivery status and restart instructions.

## Why this exists

General-purpose coding agents often approximate GOV.UK components from memory. This project gives them focused, versioned guidance covering when to use a component, its semantic HTML contract, progressive enhancement, accessibility, content rules, official sources, and reviewed tokens.

The package complements rather than replaces:

- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [GOV.UK Frontend](https://frontend.design-system.service.gov.uk/)
- [`govuk-frontend` source](https://github.com/alphagov/govuk-frontend)

## Repository layout

```text
DESIGN.md                         concise entry point for agents
src/catalog/                     canonical structured records
design/govuk/                    generated focused Markdown and install payload
tokens/                          canonical reviewed portable tokens and CSS variables
agents/govuk-design-system/      portable Agent Skill router
adapters/ai/                     generated thin AI-tool instruction routers
frameworks/                      generated framework integration guidance
evals/                           task-based AI behaviour cases
schema/                          machine-readable schemas
bin/                             installer CLI
output/                          historical extraction evidence; not published to npm
```

Generated files begin with a warning. Edit records under `src/catalog/` and run the generator instead of editing generated Markdown directly.

Target repositories can add a user-owned `DESIGN.local.md` for service context, framework choices and research-backed variations. The installer never owns that file; start from [docs/DESIGN.local.example.md](docs/DESIGN.local.example.md).

## Local development

```bash
npm run generate
npm run validate
npm test
npm run pack:check
```

To inspect the Button, Text input, and Accordion browser fixture against the
exact reviewed GOV.UK Frontend release:

```bash
npm run fixture:serve
```

Then open `http://127.0.0.1:4173`. The fixture is development-only and is not
included in the npm package.

The installer CLI can be exercised directly from this checkout. It installs the canonical records, portable tokens, Plain HTML/CSS adapter, portable Agent Skill and AI-tool routers:

```bash
node bin/govuk-design-md.js init --target /path/to/project
node bin/govuk-design-md.js check --target /path/to/project
node bin/govuk-design-md.js diff --target /path/to/project
node bin/govuk-design-md.js update --target /path/to/project
node bin/govuk-design-md.js uninstall --target /path/to/project
```

Use `--dry-run` with `init`, `add`, `update`, or `uninstall` to preview operations before files are changed. `add` is an alias for `init`.

After publication, the intended installation command is:

```bash
npx govuk-design-md@latest init
```

The package name was unclaimed when checked on 8 September 2026, but this repository has not published it yet.

### Why npx is the primary installer

`npx` is the best primary path for repositories whose users have Node.js: it is one command, needs no permanent global install, can select an exact package version, and supports safe `check`, `diff`, `update`, and `uninstall` operations. It is not sufficient for every non-developer because Node.js is still a prerequisite. A curated GitHub Release ZIP is therefore the planned secondary path for manual installation, not a replacement for the conflict-aware CLI.

See [the manual installation guide](docs/manual-install.md). Maintainers can build the same verified repository overlay locally with:

```bash
npm run release:archive
```

## Installation safety

- Existing `DESIGN.md` files are preserved; the CLI uses `GOVUK-DESIGN.md` instead.
- `DESIGN.local.md` is always user-owned and is never created, updated or removed by the CLI.
- Initial installation refuses to overwrite package-owned file destinations.
- Existing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and Copilot instruction files are preserved; the CLI appends one hash-tracked managed block.
- Cursor receives a dedicated `.cursor/rules/govuk-design-system.mdc` rule and installation refuses an existing file at that package-owned path.
- Framework guidance is installed under `frameworks/`; the current Plain HTML/CSS adapter is the reference contract for later adapters.
- `.govuk-design-md.json` records every managed path and SHA-256 hash.
- `check` reports missing or locally modified package files and managed blocks while allowing edits outside an AI adapter block.
- `diff` previews package changes; `update` replaces only content whose hash still matches the previous installation.
- A local modification stops the update and writes the proposed package content beside it as `*.govuk-design-md.new`.
- Update writes are staged and replaced atomically; `uninstall` preflights every managed entry and stops before removing anything if one was modified.

## Evidence and provenance

The original website extraction is committed under `output/design-system.service.gov.uk/`. It is useful evidence, but official guidance and the pinned `govuk-frontend` release outrank crawler inference. The current baseline is `govuk-frontend@6.5.0`; see [sources/govuk.json](sources/govuk.json). AI adapter formats and their official documentation are recorded in [sources/ai-adapters.json](sources/ai-adapters.json). Framework compatibility claims and their evidence are recorded in [sources/framework-adapters.json](sources/framework-adapters.json).

## Licensing

This repository contains differently licensed material:

- Original project code and structure: [MIT](LICENSE-CODE.md)
- Source-derived GOV.UK guidance: [Open Government Licence v3.0](LICENSE-CONTENT.md)

See [NOTICE.md](NOTICE.md) for attribution, non-endorsement, and identity-asset guidance.
