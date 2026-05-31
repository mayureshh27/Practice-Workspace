# Concept node schema: canonical name plus alias list; fuzzy dedup threshold is configurable

Every Concept node has a `canonical_name` (the preferred term from the primary
source) and `aliases: list[str]` (all other names seen across sources). At
ingestion, before creating a new node, the GraphLayer runs fuzzy string matching
(token-set ratio, default threshold 85) against all existing canonical names and
aliases. A match at or above threshold reuses the existing node and appends the
new alias; below threshold, a new node is created with the extracted name as
canonical.

The threshold is a constructor parameter on GraphLayer — not a hardcoded
constant, not an environment variable pulled at call time. This ADR is the
implementation specification for ADR-0019, which established when identity is
resolved (at ingestion, never at query time). This ADR establishes how.

The spike confirmed that Graphiti provides no native entity deduplication —
alias matching is entirely a GraphLayer wrapper responsibility. The wrapper
fetches all existing canonical names and alias arrays from Kuzu, runs token-set-
ratio comparison in Python (RapidFuzz), and conditionally executes a MERGE or
creates a new node. The threshold is the only tunable parameter in this path.
At large corpus sizes a pre-indexed alias map may be required; this is an
implementation detail of the wrapper, not a change to the decision here.

## Consequences

The threshold is a product decision, not a performance tuning decision. Setting
it too low creates two Concept nodes for what is logically one concept. Mastery
scores, blind spot detections, and prerequisite traversals then split across
both nodes, producing incorrect recommendations that are hard to diagnose.

Changing the threshold after sources have been ingested is a schema migration —
all concept nodes must be re-evaluated and potentially merged. The threshold
must be locked before the first source is ingested and treated as immutable
thereafter unless a deliberate migration is planned. This constraint must appear
in onboarding documentation for the project.
