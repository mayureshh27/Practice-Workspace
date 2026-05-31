"""
ingestion/cli.py
=================
Command-line interface for every ingestion mode.
Designed to be the single entry point you call every day.

Usage examples:

  # Deep maths book — exercise-first mode (best quality)
  python -m ingestion.cli book Strang_LA.pdf \\
      --chapter la1 --title "Vectors and Spaces" \\
      --mode exercise-first \\
      --model claude-sonnet-4-20250514 --api-key $ANTHROPIC_API_KEY

  # Regular book — section chunking
  python -m ingestion.cli book Blitzstein_Probability.pdf \\
      --chapter pr1 --title "Probability Foundations" \\
      --model claude-sonnet-4-20250514 --api-key $ANTHROPIC_API_KEY

  # YouTube lecture
  python -m ingestion.cli youtube "https://youtube.com/watch?v=xxx" \\
      --chapter la2 --whisper-size small \\
      --model claude-haiku-4-5-20251001 --api-key $ANTHROPIC_API_KEY

  # YouTube playlist (full lecture series)
  python -m ingestion.cli playlist "https://youtube.com/playlist?list=xxx" \\
      --chapter la3 --title "Eigenvalues lecture series"

  # GitHub repo
  python -m ingestion.cli github "https://github.com/cvxpy/cvxpy" \\
      --chapter cv1 --mode docs_only

  # Web article
  python -m ingestion.cli web "https://distill.pub/2016/misread-tsne/" \\
      --chapter viz1

  # Gap analysis — find missing topics in a chapter
  python -m ingestion.cli gaps --chapter la3 \\
      --model claude-haiku-4-5-20251001 --api-key $ANTHROPIC_API_KEY

  # Replay pending review queue
  python -m ingestion.cli review --chapter la1
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .generator import GeneratedProblem
from .pipeline import ExerciseFirstPipeline, IngestionPipeline
from .pipeline_stages import CATALOG_PATH, CatalogMerger, ReviewQueue, Validator

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_pipeline(args, exercise_first: bool = False):
    cls = ExerciseFirstPipeline if exercise_first else IngestionPipeline
    # Optional: wire Qdrant and Kuzu if available
    qdrant_router = None
    graph_layer = None
    try:
        from app.harness.qdrant_router import QdrantRetrievalRouter
        qdrant_router = QdrantRetrievalRouter()
    except Exception:
        pass
    try:
        from app.harness.kuzu_graph_layer import KuzuGraphLayer
        graph_layer = KuzuGraphLayer()
    except Exception:
        pass
    return cls(
        model        = args.model,
        api_key      = getattr(args, "api_key", None),
        chapter      = args.chapter,
        title        = getattr(args, "title", "") or args.chapter,
        auto_commit  = getattr(args, "commit", False),
        max_chunks   = getattr(args, "max_chunks", 40),
        qdrant_router=qdrant_router,
        graph_layer  =graph_layer,
    )

def _add_common(p: argparse.ArgumentParser):
    p.add_argument("--chapter",    required=True,
                   help="Chapter id, e.g. la1, pr2, ro3")
    p.add_argument("--title",      default="",
                   help="Human-readable chapter title")
    p.add_argument("--model",      default="claude-sonnet-4-20250514",
                   help="LLM model key")
    p.add_argument("--api-key",    dest="api_key", default=None)
    p.add_argument("--max-chunks", dest="max_chunks", type=int, default=40,
                   help="Maximum chunks to process per run")
    p.add_argument("--commit",     action="store_true",
                   help="Auto git-commit after merging")


# ─────────────────────────────────────────────────────────────────────────────
# Command handlers
# ─────────────────────────────────────────────────────────────────────────────

def cmd_book(args):
    exercise_first = getattr(args, "mode", "standard") == "exercise-first"
    p = _make_pipeline(args, exercise_first=exercise_first)
    if exercise_first:
        p.from_pdf_exercise_first(args.source,
                                   book_title=getattr(args, "title", ""))
    else:
        p.from_pdf(args.source, book_title=getattr(args, "title", ""))
    p.flush()


def cmd_youtube(args):
    p = _make_pipeline(args)
    p.from_youtube(args.source,
                   model_size=getattr(args, "whisper_size", "base"))
    p.flush()


def cmd_playlist(args):
    p = _make_pipeline(args)
    p.from_playlist(args.source,
                    model_size=getattr(args, "whisper_size", "base"))
    p.flush()


def cmd_github(args):
    p = _make_pipeline(args)
    p.from_github(args.source,
                  mode=getattr(args, "mode", "full"),
                  branch=getattr(args, "branch", "main"))
    p.flush()


def cmd_web(args):
    p = _make_pipeline(args)
    p.from_web(args.source)
    p.flush()


def cmd_text(args):
    """Ingest raw text from a file or stdin."""
    from .chunker import Strategy
    from .extractors import RawSource

    if args.source == "-":
        raw_text = sys.stdin.read()
    else:
        raw_text = Path(args.source).read_text(errors="ignore")

    p = _make_pipeline(args)
    raw = RawSource(
        text        = raw_text,
        metadata    = {"title": getattr(args, "title", "Text input")},
        source_type = "book",
    )
    p._run(raw, strategy=Strategy.FLAT_SEMANTIC,
           use_structure=False,
           source_label="stdin" if args.source == "-" else args.source)
    p.flush()


def cmd_review(args):
    """Replay pending review queue from a previous run."""
    pending_path = Path("data/pending_review.json")
    if not pending_path.exists():
        print("No pending_review.json found.")
        return

    raw_list = json.loads(pending_path.read_text())
    if not raw_list:
        print("pending_review.json is empty.")
        return

    print(f"Found {len(raw_list)} problems pending review.")
    problems  = [GeneratedProblem(**d) for d in raw_list]
    validator = Validator()
    queue     = ReviewQueue(validator)
    merger    = CatalogMerger()

    for p in problems:
        result = validator.validate(p)
        queue.review(p, result)

    queue.flush_pending()
    if queue.approved:
        merger.merge(
            queue.approved,
            args.chapter,
            getattr(args, "title", args.chapter),
            auto_commit=getattr(args, "commit", False),
        )
        # Clear approved from pending file
        remaining = [d for d in raw_list
                     if d["id"] not in {p.id for p in queue.approved}]
        pending_path.write_text(json.dumps(remaining, indent=2))


def cmd_gaps(args):
    """
    Identify concept gaps in a chapter.
    Compares existing problem tags against a standard curriculum
    for that chapter's domain and suggests what is missing.
    """
    import litellm

    if not CATALOG_PATH.exists():
        print("No catalog found. Run ingestion first.")
        return

    catalog = json.loads(CATALOG_PATH.read_text())
    chapter_problems = [
        {
            "id":         p["id"],
            "tags":       p.get("tags", []),
            "difficulty": p.get("difficulty"),
            "statement":  p.get("statement", "")[:120],
        }
        for p in catalog.get("problems", [])
        if p.get("chapter") == args.chapter
    ]

    if not chapter_problems:
        print(f"No problems found for chapter {args.chapter}.")
        return

    print(f"Analysing {len(chapter_problems)} problems in chapter "
          f"{args.chapter}...")

    prompt = f"""
You are reviewing a robotics/mathematics learning platform chapter catalog.
Chapter: {args.chapter}

Existing problems:
{json.dumps(chapter_problems, indent=2)}

Task: Identify concept gaps — topics a student must understand for this
chapter that have FEWER THAN 2 problems covering them.

Consider both:
  - Core mathematical concepts (definitions, theorems, proofs)
  - Computational skills (algorithms, numerical methods, code patterns)
  - Intuition builders (geometric interpretation, special cases)

Return JSON:
{{
  "gaps": [
    {{
      "topic": "concept name",
      "current_coverage": 0,
      "importance": "high|medium|low",
      "reason": "why this matters for the chapter",
      "suggested_problem": "one-sentence description of a good exercise",
      "suggested_tags": ["tag1", "tag2"]
    }}
  ]
}}
"""

    resp = litellm.completion(
        model    = args.model,
        api_key  = getattr(args, "api_key", None),
        messages = [{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_tokens=2000,
    )

    result = json.loads(resp.choices[0].message.content)
    gaps   = result.get("gaps", [])

    print(f"\n  Found {len(gaps)} gaps in chapter {args.chapter}:\n")
    for g in gaps:
        imp_colour = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(
            g.get("importance", "low"), "⚪"
        )
        print(f"  {imp_colour} {g['topic']}  "
              f"(coverage={g.get('current_coverage',0)})")
        print(f"     Why: {g.get('reason', '')}")
        print(f"     → {g.get('suggested_problem', '')}")
        tags = g.get("suggested_tags", [])
        if tags:
            print(f"     tags: {', '.join(tags)}")
        print()

    # Write gap report
    out = Path(f"data/gaps_{args.chapter}.json")
    out.write_text(json.dumps(result, indent=2))
    print(f"  Gap report written to {out}")
    print("\n  To fill a gap, run:")
    print(f"    echo '<description>' | python -m ingestion.cli text - "
          f"--chapter {args.chapter} --model {args.model}")


# ─────────────────────────────────────────────────────────────────────────────
# Argument parser
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        prog        = "python -m ingestion.cli",
        description = "Ingestion pipeline for the personal learning platform",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    # book
    p_book = sub.add_parser("book", help="Ingest a PDF, LaTeX, or EPUB book")
    p_book.add_argument("source", help="Path to book file")
    p_book.add_argument("--mode", choices=["standard", "exercise-first"],
                        default="exercise-first",
                        help="exercise-first: extract verbatim exercises first (best for maths)")
    _add_common(p_book)
    p_book.set_defaults(func=cmd_book)

    # youtube
    p_yt = sub.add_parser("youtube", help="Ingest a YouTube video")
    p_yt.add_argument("source", help="YouTube URL")
    p_yt.add_argument("--whisper-size", dest="whisper_size",
                      choices=["tiny","base","small","medium"],
                      default="base",
                      help="Whisper model size — larger=better but slower")
    _add_common(p_yt)
    p_yt.set_defaults(func=cmd_youtube)

    # playlist
    p_pl = sub.add_parser("playlist", help="Ingest a YouTube playlist")
    p_pl.add_argument("source", help="YouTube playlist URL")
    p_pl.add_argument("--whisper-size", dest="whisper_size",
                      choices=["tiny","base","small","medium"], default="base")
    _add_common(p_pl)
    p_pl.set_defaults(func=cmd_playlist)

    # github
    p_gh = sub.add_parser("github", help="Ingest a GitHub repo or local dir")
    p_gh.add_argument("source", help="GitHub URL or local path")
    p_gh.add_argument("--mode",
                      choices=["full","docs_only","code_only"],
                      default="full")
    p_gh.add_argument("--branch", default="main")
    _add_common(p_gh)
    p_gh.set_defaults(func=cmd_github)

    # web
    p_web = sub.add_parser("web", help="Ingest a web article or arXiv paper")
    p_web.add_argument("source", help="URL")
    _add_common(p_web)
    p_web.set_defaults(func=cmd_web)

    # text
    p_tx = sub.add_parser("text", help="Ingest raw text from file or stdin")
    p_tx.add_argument("source", help="File path or - for stdin")
    _add_common(p_tx)
    p_tx.set_defaults(func=cmd_text)

    # review
    p_rv = sub.add_parser("review", help="Replay pending review queue")
    p_rv.add_argument("--chapter", required=True)
    p_rv.add_argument("--title",   default="")
    p_rv.add_argument("--commit",  action="store_true")
    p_rv.set_defaults(func=cmd_review)

    # gaps
    p_gp = sub.add_parser("gaps", help="Find concept gaps in a chapter")
    p_gp.add_argument("--chapter",  required=True)
    p_gp.add_argument("--model",    default="claude-haiku-4-5-20251001")
    p_gp.add_argument("--api-key",  dest="api_key", default=None)
    p_gp.set_defaults(func=cmd_gaps)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
