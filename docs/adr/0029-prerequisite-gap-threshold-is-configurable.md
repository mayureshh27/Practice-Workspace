# Prerequisite gap threshold is a configurable GraphLayer parameter, not a hardcoded constant

The `detect_prerequisite_gaps()` method classifies a prerequisite concept as a
gap when its current mastery score falls below a threshold. This threshold
(default 0.5) is a constructor parameter on GraphLayer — not a hardcoded
constant, not shared with the blind spot detection threshold (which operates on
attempt counts and session counts, not mastery scores), and not the same as the
mastery clearing threshold used by blind spot resolution (0.70).

The gap threshold directly governs what the tutor sees in the `graph_seed`
context slot: only prerequisites at or below the threshold are surfaced as gaps
needing remediation. A threshold that is too low floods the context slot with
concepts the learner partially understands; a threshold that is too high misses
real gaps. The choice of 0.5 as default reflects the midpoint of the [0.0, 1.0]
mastery range — concepts below halfway are considered insufficiently understood
to support dependent learning. This is a product judgment, not a mathematical
optimum, and different domains (code exercises vs theory questions) may warrant
different values.

## Consequences

Three distinct thresholds exist in the system and must never be conflated:

| Threshold | Default | Governs | ADR |
|---|---|---|---|
| Prerequisite gap | 0.5 | `detect_prerequisite_gaps()` output | This ADR |
| Blind spot detection | N attempts / M sessions (count-based) | `BlindSpotDetected` event emission | ADR-0005 + PRD |
| Blind spot clearing | 0.70 mastery score | `BlindSpot.resolved_at` | ADR-0005 + PRD |

All three are configurable. None is hardcoded. Documentation must be explicit
that changing the prerequisite gap threshold after a learner has active sessions
changes which prerequisites the tutor considers as gaps — this affects hint
strategy mid-curriculum and should be treated as a deliberate product change,
not a routine configuration adjustment.
