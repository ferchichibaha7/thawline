# Contributing

Thank you for helping. Thawline only publishes what public sources support, so contributions follow the same rule.

## What goes through GitHub

- Code: fixes and features. Open an issue first for anything large.
- Taxonomy: role families in `pipeline/thawline/taxonomy/families.yaml`, and later the skills list.
- Source lists: job boards, publishers and feeds, once those phases start.

Evidence about companies does not go through pull requests. It goes through the form on the site, so that it is extracted, checked and reviewed by a moderator.

## Rules

- Never add invented numbers, sample companies or placeholder series to anything that can reach the site. Test fixtures must be recorded from real responses and live in `tests/fixtures/`.
- Every number shown carries its source and date.
- A change to a weight, threshold or formula changes `config/metrics.json`, bumps the version string there, and adds a line to `web/content/method/08-changelog.md`.
- Follow the design rules in the build specification, section 3. No gradients, shadows, all-caps labels or decorative icons.

## Running it locally

See the README. Before opening a pull request, run:

```
cd pipeline && .venv/bin/python -m pytest
cd web && npm run typecheck && npm test
```
