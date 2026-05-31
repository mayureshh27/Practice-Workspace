# Retrieval Router Mandates Source IDs At Type Level

All three retrieval modes in the Retrieval Router (`source_search_semantic`, `source_search_exact`, `source_search`) require `source_ids: list[str]` as a mandatory positional parameter at the Python type level. There is no default value, no optional keyword, and no "search all sources" convenience method in the production retrieval interface. Source filtering is applied at query construction time inside Qdrant, not as post-retrieval filtering over results.

## Consequences

Source pollution — chunks from inactive or unselected sources entering the context window — cannot occur through accidental omission. In a codebase under development, optional parameters are exercised without their optional arguments by mistake. Making `source_ids` mandatory turns this into a `TypeError` at call time rather than a subtle retrieval correctness bug that only manifests when the source corpus grows large enough for cross-source contamination to affect answers. The distinction between query-time filtering and post-retrieval filtering matters for ranking: if an out-of-scope chunk would have ranked first, post-retrieval filtering removes it but the remaining results were ranked in competition with it, displacing more relevant in-scope chunks. The Retrieval Router's Qdrant query always includes the source_ids filter in the query payload, never in application code after the response.

## Considered Options

- Optional `source_ids` with default=None meaning "all sources": convenient during development, permanently unsafe in production when the corpus spans dozens of sources across unrelated domains.
- Post-retrieval filtering in application code: correct filtering but incorrect ranking — discarded chunks affected the score of retained chunks.
- Mandatory `source_ids` at type level with query-time filtering: chosen. Type error at callsite during development; correct ranking in production.
