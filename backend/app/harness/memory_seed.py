"""Memory Seed Protocol — harness primitive for pre-session state materialisation.

Per CONTEXT.md and ADR-0005:
- The Memory Seed Protocol materialises the learner state as four structured
  Markdown files in the ``/memories/`` folder before a session begins:
  * mastery.md
  * blind_spots.md
  * active_sources.md
  * position.md
- The agent reads these files via tool call; they are never injected
  into the seed context (seed-and-discover pattern, ADR-0015).
"""

from pathlib import Path
from sqlmodel import Session, select

from app.domain.events import ConceptMasteryUpdated
from app.storage import event_store


def materialise_learner_state(session: Session, memories_dir: Path) -> None:
    """Export the active learner state to structured Markdown files in the memories directory."""
    memories_dir.mkdir(parents=True, exist_ok=True)

    # 1. mastery.md
    mastery_file = memories_dir / "mastery.md"
    statement = select(ConceptMasteryUpdated).order_by(
        ConceptMasteryUpdated.timestamp.desc()
    )
    all_updates = session.exec(statement).all()
    seen_concepts = set()
    mastery_lines = [
        "# Learner Concept Mastery\n",
        "Durable pedagogical mastery scores for active learning concepts. Updated deterministically.",
        "",
    ]
    for up in all_updates:
        if up.concept_id not in seen_concepts:
            seen_concepts.add(up.concept_id)
            mastery_lines.append(
                f"- Concept `{up.concept_id}`: Mastery Score **{up.new_mastery:.2f}** (Updated from attempt `{up.trigger_event_id}`)"
            )
    if len(seen_concepts) == 0:
        mastery_lines.append("No concepts practiced yet.")
    mastery_file.write_text("\n".join(mastery_lines), encoding="utf-8")

    # 2. blind_spots.md
    blind_spots_file = memories_dir / "blind_spots.md"
    active_spots = event_store.get_blind_spots(session, resolved=False)
    bs_lines = [
        "# Active Learner Blind Spots\n",
        "Concepts where the learner is struggling (>=3 attempts across >=3 sessions, hints not decreasing).",
        "",
    ]
    for bs in active_spots:
        bs_lines.append(
            f"- Concept `{bs.concept_id}`: {bs.attempt_count} attempts across {bs.session_count} distinct sessions."
        )
    if len(active_spots) == 0:
        bs_lines.append("No active blind spots. Great job!")
    blind_spots_file.write_text("\n".join(bs_lines), encoding="utf-8")

    # 3. active_sources.md
    active_sources_file = memories_dir / "active_sources.md"
    active_sources_lines = [
        "# Active Learning Sources\n",
        "Learning sources currently referenced in the active learning loop.",
        "",
        "(No active source links recorded in the event log yet.)",
    ]
    active_sources_file.write_text("\n".join(active_sources_lines), encoding="utf-8")

    # 4. position.md
    position_file = memories_dir / "position.md"
    position_lines = [
        "# Current Session Position\n",
        "The tracked cursor, line, or progress marker within active sources.",
        "",
        "(No active session position markers recorded yet.)",
    ]
    position_file.write_text("\n".join(position_lines), encoding="utf-8")
