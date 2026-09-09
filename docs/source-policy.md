# Source and review policy

## Pinned baseline

- GOV.UK Frontend: `6.5.0`
- Initial review date: 2026-09-09
- Design System: <https://design-system.service.gov.uk/>
- Implementation: <https://github.com/alphagov/govuk-frontend>

`sources/govuk.json` is the machine-readable record of this baseline.

## Review rules

- Store a source URL and reviewed date on every canonical record.
- Store the implementation directory where a component exists in `govuk-frontend`.
- Copy numerical values only from reviewed upstream or extraction data.
- Paraphrase usage guidance unless exact wording is required and licensed attribution is retained.
- Keep lifecycle status explicit; do not silently treat Trial components as Stable.
- Do not infer a supported dark theme when light and dark values do not differ.
- Never bundle GDS Transport, the GOV.UK crown, or other identity assets. Direct eligible services to official installation guidance.

## Update process

An upstream change should create a review diff containing:

- added, removed, or renamed catalog items;
- lifecycle-status changes;
- changed HTML, macro options, classes, or JavaScript modules;
- changed reviewed token values;
- affected generated documents and fixtures.

Generated changes are merged and released only after human review.

