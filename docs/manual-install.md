# Manual ZIP installation

The GitHub Release ZIP is the secondary installation path for people who cannot run Node.js. Use the `npx` installer when possible because it detects conflicts, tracks hashes and supports safe updates.

## Download the correct release

Download `govuk-design-md-vX.Y.Z.zip` from the matching GitHub Release and extract it outside the target repository. The archive contains a `repository-overlay/` directory prepared by the same CLI used by the npm package.

Do not download GitHub's automatically generated “Source code” archive for installation. It contains development evidence and is not the curated install payload.

## New or empty repository

1. Make a backup or commit the repository before copying files.
2. Confirm that none of the paths in `repository-overlay/` already exist in the target.
3. Copy the complete contents of `repository-overlay/`, including dotfiles, into the repository root.
4. Open `DESIGN.md` and confirm that its links to `design/govuk/` and `frameworks/` work.
5. Keep `.govuk-design-md.json`; it allows a future CLI installation to verify and update this exact overlay.

Never approve an operating-system overwrite prompt. A collision means the repository is not empty enough for the clean-overlay procedure.

## Existing repository without Node.js

Do not copy the complete overlay over an existing repository. The safe manual procedure is:

1. Copy `design/govuk/`, `frameworks/`, and `.agents/skills/govuk-design-system/` only when their destination paths are unused.
2. If the repository already has `DESIGN.md`, copy the overlay entry point as `GOVUK-DESIGN.md`; otherwise use `DESIGN.md`.
3. For `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`, append exactly the content between and including the `govuk-design-md:start` and `govuk-design-md:end` markers. Never replace existing instructions.
4. Copy `.cursor/rules/govuk-design-system.mdc` only when that exact path is unused.
5. Do not copy `.govuk-design-md.json` after a partial or merged installation. It would claim ownership of files the CLI did not install.
6. Record the installed package and GOV.UK Frontend versions in the project's own documentation.

If any destination already contains GOV.UK guidance or a `govuk-design-md` marker, stop and ask a developer to reconcile the content. Manual merged installs must be compared by hand on every update.

## Identity and licensing

Keep `design/govuk/NOTICE.md`, `design/govuk/LICENSE-CONTENT.md`, and `design/govuk/LICENSE-CODE.md` with the installed guidance. This project does not distribute GDS Transport, the GOV.UK crown, or other identity assets. Confirm eligibility and obtain those assets through official GOV.UK Frontend guidance.

## Preferred npx path

When Node.js is available, use:

```bash
npx govuk-design-md@X.Y.Z init
npx govuk-design-md@X.Y.Z check
```

Pinning `X.Y.Z` makes the installation reproducible. Read the release notes and run `diff` before moving to a newer package version.
