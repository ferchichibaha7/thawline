## Signals

A signal is a dated one-sentence fact produced by a fixed rule from the four-week average of a postings index.

- Crossed the line: the average moves from below 100 to 100 or above.
- Streak: the average has moved in one direction for {{signals.streak_lengths}} consecutive weeks.
- State change: the Thaw Index state of a sector's roles changes and holds for {{signals.state_hold_weeks}} weeks. While roles share a sector score, one signal covers all roles in that sector.

The same kind of signal is not repeated for the same subject within {{signals.cooldown_days}} days. Rules run over the last {{signals.lookback_weeks}} weeks of data.
