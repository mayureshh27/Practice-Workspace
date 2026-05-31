# Five Agent Roles Have Distinct Harness Configurations

The platform defines five agent roles — Ingestion Agent, Tutor Agent, Workflow Agent, Session Summary Agent, and Eval Agent — each with a distinct configuration of the eight harness primitives. There is no single universal harness configuration shared across roles. The Ingestion Agent runs in deep_source mode with no learner memory or graph seed slots and uses extractor tools. The Tutor Agent runs in conservative mode with the full Memory Seed Protocol and Socratic Gate. The Workflow Agent uses an expanded source-chunks budget and the Artifact Gate. The Session Summary Agent receives a serialised event list as its entire input and calls no tools. The Eval Agent uses an adversarial prompt configuration to probe for Socratic leakage and hallucination.

## Consequences

Each role's harness configuration is documented as a named constant in the harness layer — `INGESTION_HARNESS_CONFIG`, `TUTOR_HARNESS_CONFIG`, etc. These are instantiated separately; there is no inheritance or composition pattern that could allow one role's configuration to accidentally leak into another. The most critical boundary is between the Tutor Agent (deep_source=False, always) and the Ingestion Agent (deep_source=True, always). These two must never share a configuration object. Practically, this means the Tutor Agent's `ContextGate` is constructed without a `deep_source` parameter anywhere in its call stack — the parameter simply does not appear. The Session Summary Agent's configuration is the thinnest: no Context Gate slots beyond system and user, no tools, no retrieval — it is deliberately stateless so it can be tested with a pure event list fixture.

## Considered Options

- One universal agent class configured by kwargs per call: flexible but makes it easy to accidentally pass deep_source=True to a tutor call or omit source_ids from a retrieval call in shared code paths.
- Separate agent classes per role: chosen. Each role is a distinct instantiation with its own configuration validated at construction time. Cross-role contamination is a type error, not a runtime surprise.
- Shared base with role-specific subclasses: introduces inheritance complexity with no benefit — the roles are not variations on a theme, they are fundamentally different pipeline stages.
