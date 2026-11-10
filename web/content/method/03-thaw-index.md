## Thaw Index

Version `{{thaw_index.version}}`. A score from 0 to 100 for each role, country and week. It is a weighted mean of up to five parts, each scored from 0 to 100 and clamped to that range.

| Part | Weight | Input | Score |
|---|---|---|---|
| Level | {{thaw_index.weights.level}} | I, the four-week average of the role's sector index | (I − {{thaw_index.level.floor}}) ÷ {{thaw_index.level.span}} × 100 |
| Momentum | {{thaw_index.weights.momentum}} | M, the percent change of that average over {{thaw_index.momentum.weeks}} weeks | (M + 10) ÷ {{thaw_index.momentum.span}} × 100 |
| Breadth | {{thaw_index.weights.breadth}} | Share of tracked companies with an open posting for the role | Against its own 52-week range |
| Entry access | {{thaw_index.weights.entry_access}} | Share of open postings at intern or junior level | J ÷ 0.25 × 100 |
| Competition | {{thaw_index.weights.competition}} | Hacker News hiring threads: jobs offered per person looking | (R − 0.5) ÷ 2.5 × 100 |

In words: a sector at 60 or below on the index scores 0 for Level, at the line it scores 80, and at 110 or above it scores 100. Postings falling 10% in 13 weeks score 0 for Momentum, flat scores 50, and rising 10% scores 100.

When a part is missing, its weight is dropped and the others are scaled up to sum to 100. Level and Momentum are required. Today only those two exist, so Level counts for {{derived.level_share}}% and Momentum for {{derived.momentum_share}}%. Breadth, entry access and competition need job-board data that Thawline has not started collecting.

States: 0 to 24 Frozen, 25 to 49 Cold, 50 to 74 Thawing, 75 to 100 Open.

Each role uses one Indeed sector. Several roles share a sector, so they share a score until role-level data arrives. The mapping, and why some roles differ from the obvious choice, is in the repository's decision log.
