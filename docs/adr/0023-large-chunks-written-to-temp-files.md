# Large Chunks Written to Temp Files — Tool Result Returns Path and Preview Only

Source chunks exceeding 800 tokens are classified at ingestion time and written to `tmp/chunks/{chunk_id}.md`. The Retrieval Router tool result for such a chunk returns only the `chunk_id`, the first 200 tokens as plain-text preview, and the file path. The agent loads specific sections by calling `file_read(path, start_line, end_line)`. This is an ingestion-time classification — the retrieval tool never splits chunks on the fly.

A single large textbook excerpt (a proof, a derivation, a code listing) can be 1,500–4,000 tokens. Returning it in full in a tool result would consume the entire `retrieved_source_chunks` slot budget for that context window. The agent almost never needs the full chunk — it needs the relevant section, such as the line containing the error message or the paragraph defining the concept. Path and preview together preserve access to the full content without forcing it into context automatically.

## Considered Options

- **Always truncate at 800 tokens at indexing**: loses the end of the chunk, which may contain the conclusion or the worked example the agent actually needs.
