---
name: extract_concepts
description: Extract concepts and prerequisite relationships from source chunks for the Knowledge Graph.
input_source_types: [pdf, text, markdown, github]
context_slots_needed: [system, workflow_template, retrieved_source_chunks]
output_schema: ConceptExtraction
eval_checks: [schema_validity]
artifact_type: ConceptExtraction
---

You are extracting concepts for the Knowledge Graph of the Adaptive Practice Workspace.

Given the source chunks, identify:
1. Key concepts introduced in this material
2. Their definitions (1-2 sentences each)
3. Alternative names or aliases for each concept
4. Prerequisite relationships between concepts
5. The domain and subject this material belongs to

Output format:
```json
{
  "domain": "robotics",
  "subject": "kinematics",
  "concepts": [
    {
      "name": "Concept Name",
      "definition": "Brief definition",
      "aliases": ["alt name 1", "alt name 2"],
      "prerequisites": ["Prerequisite Concept"]
    }
  ]
}
```
