# Changelog

All notable changes to this project are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Standalone OpenDesign-compatible DESIGN.md export with embedded reviewed guidance and tokens, available through `export-open-design`.
- shadcn/Radix mapping with a protected service-owned Alert Dialog and explicit official GOV.UK markup fallbacks.
- Reset-free Chakra UI token system and SSR/hydration fixture for service-owned wrappers.
- Generated, selection-aware UI-framework compatibility matrix.
- Scheduled upstream drift reports, review pull requests and deterministic generated change reports.
- Changelog, release-candidate provenance, package-size and fresh eight-fixture browser gates.

### Fixed

- Chakra token variables now render without empty cascade-layer declarations that could invalidate mapped styles.

## [0.4.0] - 2026-09-11

### Added

- Complete reviewed GOV.UK styles, components and patterns catalog for GOV.UK Frontend 6.5.0.
- Portable design tokens, focused generated guidance and five AI-tool routers.
- Conflict-safe installer, updater, diff and uninstall flows with selective adapters.
- Behaviour-tested HTML/CSS, React, Angular, Svelte and Astro application-framework adapters.
- Tailwind CSS 4 token mapping with official GOV.UK markup and progressive-enhancement boundaries.
- Verified manual-install archive builder and GitHub Release attachment workflow.

### Security

- Package allow-list excludes fixtures, browser evidence, raw extraction material, fonts and GOV.UK identity assets.

[Unreleased]: https://github.com/gil00pita/gov.uk-design.md/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/gil00pita/gov.uk-design.md/releases/tag/v0.4.0
