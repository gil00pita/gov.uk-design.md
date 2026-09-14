# Import into OpenDesign

This package targets [OpenDesign by nexu-io](https://github.com/nexu-io/open-design). Its design-system loader supports a folder containing a single `DESIGN.md`, with an H1 title, category, optional YAML metadata and Markdown guidance.

Use [the standalone OpenDesign export](../adapters/open-design/DESIGN.md). It embeds all 13 foundations, 37 components, 30 patterns and the reviewed portable CSS tokens. The repository's root `DESIGN.md` is an agent router with relative links; importing that file alone would omit the linked guidance.

## Export the file

From this repository:

```sh
node bin/govuk-design-md.js export-open-design --target ./release/open-design/govuk
```

With an installed version containing this feature:

```sh
govuk-design-md export-open-design --target ./govuk-open-design
```

The command creates `DESIGN.md` in the target directory. It refuses to overwrite an existing file, including a symlink, and supports `--dry-run`. No framework, UI-framework or AI adapter selection is needed.

## Use the exported Markdown

If your OpenDesign version provides a Markdown attachment or import control, select the exported `DESIGN.md`. Use this project instruction:

> Use the attached DESIGN.md as the GOV.UK design guidance for this project. Preserve the component HTML, accessibility and progressive-enhancement contracts. Use the reviewed GOV.UK Frontend implementation and respect the documented font and identity eligibility requirements.

The availability of a dedicated DESIGN.md picker varies by OpenDesign version; this package supplies compatible content and does not add controls to the external app.

For a source installation, export directly into a new folder under OpenDesign's design-system library, then reload its library:

```sh
govuk-design-md export-open-design --target /path/to/open-design/design-systems/govuk
```

OpenDesign also exposes `POST /api/design-systems` with `title`, `category`, `surface` and Markdown `body` fields for creating a custom system. Integrations can submit the exported file's full text as `body`, using the authentication and workspace context required by their OpenDesign deployment. The export command itself does not contact or change an OpenDesign installation.

Do not substitute `od design-systems import-local` when exact Markdown preservation is required: the inspected importer scans a project and generates a new DESIGN.md from its detected signals.

## Compatibility and maintenance

Compatibility is based on the official [design-system loader](https://github.com/nexu-io/open-design/blob/main/apps/daemon/src/design-systems/index.ts), [frontmatter parser](https://github.com/nexu-io/open-design/blob/main/apps/daemon/src/design-systems/frontmatter.ts), [creation endpoint](https://github.com/nexu-io/open-design/blob/main/apps/daemon/src/routes/design-systems.ts) and [local importer](https://github.com/nexu-io/open-design/blob/main/apps/daemon/src/design-systems/import.ts), inspected on 2026-09-14. It does not claim a live desktop-app import test.

Run `npm run generate` after changing the reviewed catalog or tokens. The generated export is covered by the existing stale-output validation and package allow-list checks. Importing guidance or tokens does not establish GOV.UK conformance, and the export does not redistribute fonts or identity assets.
