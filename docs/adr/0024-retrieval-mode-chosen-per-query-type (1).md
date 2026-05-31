# Retrieval Mode Chosen Per Query Type, Not Per Workflow

The Retrieval Layer exposes two tools — `source_search(query, mode, filters)` where `mode` is `semantic | hybrid` (default hybrid), and `source_search_exact(tokens)` which is a dedicated BM25-only tool with its own schema in `tool_registry/`. The agent selects between them based on the content of the current query, not from a fixed setting in the Workflow Template. The mapping: conceptual questions use `source_search(mode="semantic")`; error messages, function names, quoted lecture text, and variable names from student code use `source_search_exact`; all other hint calls use `source_search` with the hybrid default.

A single practice session mixes both retrieval types. A learner submitting code with a `NameError` needs exact retrieval to find the chunk where the variable was defined; the same learner asking why eigenvalue placement works needs semantic retrieval. Fixing the tool choice at workflow level would require separate workflows or force the wrong retrieval path on half the queries in every session. `source_search_exact` is a distinct named tool rather than a mode flag on `source_search` so the agent's tool call is unambiguous and the Tool Registry schema for exact search carries no `mode` parameter.

## Considered Options

- **Always use hybrid, let RRF fusion handle both query types**: correct for most queries, but BM25 alone outperforms hybrid on exact-token queries (error messages, API names) because dense vectors on short error strings return semantically plausible but textually wrong chunks.
