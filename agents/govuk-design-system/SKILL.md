---
name: govuk-design-system
description: Build or review user-facing services with GOV.UK Design System components, patterns, content rules, accessibility contracts, or framework integrations. Use when a task requests GOV.UK styling or behaviour; do not use merely because a project belongs to a public-sector organisation.
---

# GOV.UK Design System

Use the repository's reviewed GOV.UK catalog instead of recreating the system from memory.

## Workflow

1. Read the repository-root `DESIGN.md` or `GOVUK-DESIGN.md` entry point.
2. Use `design/govuk/catalog.json` to identify the relevant focused style, component or pattern records.
3. Read only those focused Markdown files and the adapter for the project's framework, when present.
4. Preserve the official semantic DOM, GOV.UK classes, progressive enhancement, focus behaviour, labels, error relationships, and content rules.
5. If the installed guidance is older than the project's `govuk-frontend` version, consult the authoritative URLs recorded in the catalog before changing code.

## Boundaries

- Treat GOV.UK Design System guidance and the pinned `govuk-frontend` implementation as authoritative.
- Do not infer compliance from visual resemblance or a Tailwind, shadcn, or Chakra theme mapping.
- Do not invent variants, tokens, markup, accessibility behaviour, or content guidance.
- Do not remove native semantics to satisfy a framework abstraction.
- Keep server-rendered HTML functional before JavaScript enhancement.
- State when no reviewed adapter or canonical record covers the requested implementation.
- Do not claim that this community package is an official GOV.UK product.
- Do not introduce GDS Transport or GOV.UK identity assets without checking that the service is eligible to use them.

## Authoritative sources

- GOV.UK Design System: <https://design-system.service.gov.uk/>
- GOV.UK Frontend documentation: <https://frontend.design-system.service.gov.uk/>
- GOV.UK Frontend source: <https://github.com/alphagov/govuk-frontend>
