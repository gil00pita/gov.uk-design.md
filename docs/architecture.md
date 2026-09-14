# Architecture

## Purpose

`govuk-design-md` packages focused, traceable GOV.UK design-system guidance for coding agents. It does not replace the official GOV.UK Design System or `govuk-frontend`.

## Source precedence

1. GOV.UK Design System guidance defines when and why to use an element.
2. The pinned `govuk-frontend` release defines implementation markup, classes, macro APIs, assets, and JavaScript behaviour.
3. Extracted computed styles and screenshots provide corroborating evidence and help detect visual changes.
4. Project-authored interpretation may explain integration, but must not invent GOV.UK requirements.

When sources disagree, record the disagreement and prefer the higher-ranked source until reviewed.

## Data flow

```text
 official sources + reviewed extraction evidence
                         |
                         v
 src/catalog/**/*.json + reviewed adapter manifests
                         |
                         v
                   deterministic generator
          /          |          |          |          \
         v           v          v          v           v
  DESIGN.md   catalog.json  design/govuk/  frameworks/  ui-frameworks/
```

Structured records are canonical. Generated files carry a warning and must not be edited directly.

## Distribution layers

- `DESIGN.md`: compact entry point and hard constraints.
- `design/govuk/`: focused generated component, pattern, and foundation guidance.
- `catalog.json`: machine-readable inventory for CLIs and integrations.
- `tokens/`: reviewed portable token exports and CSS custom properties, never raw crawler output.
- `agents/`: thin routing instructions.
- `adapters/ai/`: generated tool-specific routers; shared instruction files use a package-owned managed block.
- `frameworks/`: generated integration adapters that translate asset, rendering and lifecycle concerns without redefining canonical behaviour. Plain HTML/CSS is the tested reference contract. React uses immutable, scoped enhancement boundaries; Angular uses static OnPush leaf components and delays enhancement until after hydration stability; Svelte uses static captured snippets and a client-only `onMount` boundary after hydration; native Astro templates emit stable HTML without a client runtime and add GOV.UK Frontend through a processed browser script. Each keeps framework updates away from DOM that GOV.UK Frontend mutates.
- `ui-frameworks/`: generated, separately selectable utility and component-library mappings plus a selection-aware compatibility matrix. Tailwind CSS 4 receives a canonical-token bridge for service-owned extensions while Preflight and component recreation remain out of scope. shadcn uses reviewed, locally owned Radix composition only where no GOV.UK component applies and demonstrates explicit official-markup fallbacks. Chakra receives a reset-free token system for service-owned wrappers. Compatibility remains bounded and cannot establish conformance from theming alone.

## Compatibility terminology

- **Guidance compatible**: the adapter links to the correct GOV.UK usage and content rules.
- **Token compatible**: the adapter maps reviewed values without claiming equivalent markup.
- **Markup compatible**: output preserves the official semantic DOM and class contract.
- **Behaviour tested**: JavaScript, keyboard, focus, and progressive-enhancement behaviour have automated coverage.

No adapter should claim general GOV.UK conformance from colour or theme mapping alone.

## Installation ownership

The CLI owns only files or marked blocks recorded in `.govuk-design-md.json`. Schema v4 stores a generated hash for each package file or block plus the selected application-framework, UI-framework and AI adapter IDs, so updates retain the installation scope. A schema-v3 installation does not silently opt into a newly introduced UI-framework adapter during update. Existing root design guidance is preserved by installing the GOV.UK entry point as `GOVUK-DESIGN.md`. Existing AI instruction files keep all content outside the `govuk-design-md` markers; `check` hashes only the managed block.

`init` and `add` accept non-interactive `--framework`, `--ui` and `--ai` selections and prompt for missing choices only on a TTY. Installed manifests and entry-point links are filtered together so they cannot reference omitted adapter files. Non-interactive calls without selection flags retain the historical install-all behaviour.

`DESIGN.local.md` is a user-owned extension point for service context, integration choices and research-backed variations. Agents read it after the package entry point, but it does not redefine what is official GOV.UK guidance. The CLI never owns or mutates it.

## Evidence policy

The original raw extraction was removed from the maintained tree after the reviewed catalog and provenance manifests were created. Compact browser smoke evidence remains under `output/playwright/` and is excluded from npm publication. Future extractions should be reproducible CI artifacts or release attachments; only reviewed, compact derivatives belong in the package.

## Automation and release gates

Pull-request CI regenerates outputs, records a deterministic diff, rejects stale generation, validates source and local links, exercises installer and fixture contracts, runs all eight fixtures in Chromium, and checks the npm allow-list. Desktop and mobile screenshots are uploaded as review evidence rather than shipped in the package.

The weekly upstream monitor compares the latest `govuk-frontend` package and the official style, component and pattern inventories with the reviewed source manifest. Drift creates a report-only pull request; it never rewrites canonical records. Tag builds require a matching dated changelog entry and emit unsigned candidate provenance containing package digests, the Git commit, the reviewed upstream, source and lockfile digests, and measured package size. Registry publication remains a maintainer action and must add npm provenance.
