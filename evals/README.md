# Agent evaluation cases

`tasks.json` is a model-agnostic evaluation set for the installed guidance. Each case contains a user prompt, the canonical records an agent should consult, and an observable pass/fail rubric.

The suite covers five dimensions:

- record selection
- markup fidelity
- progressive enhancement
- accessibility
- non-invention of GOV.UK values, variants and identity permissions

Run `npm run evals:validate` to check the suite structure and canonical references. A release evaluator can send each prompt to any supported agent with a clean fixture repository, capture its patch and explanation, and score every `must` and `mustNot` item. Model responses are intentionally not committed as timeless evidence because model and tool behaviour changes independently of this package.
