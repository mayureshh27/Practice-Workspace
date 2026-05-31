"""
ingestion/pipeline.py
======================
Top-level orchestrator: source → problems.json

Wires all stages together:
  1. Extract   — source-specific extractor → RawSource
  2. Normalise — unicode, math tags, heading normalisation
  3. Structure — book hierarchy detection (book sources only)
  4. Chunk     — semantic windows with protected-block awareness
  5. Generate  — LLM → GeneratedProblem (Instructor-validated)
  6. Validate  — syntax + sandbox + quality score
  7. Retry     — up to MAX_RETRIES with error feedback
  8. Dedup     — cosine similarity + slug check
  9. Review    — CLI queue (auto-pass high quality)
  10. Merge    — atomic write to problems.json

Each source type follows the same stages but with different
extractor, normaliser hints, chunk strategy, and prompt template.

Usage:
  pipeline = IngestionPipeline(
      model    = "claude-sonnet-4-20250514",
      api_key  = "sk-ant-...",
      chapter  = "la1",
      title    = "Vectors and Spaces",
  )
  pipeline.from_pdf("Strang_LA.pdf")
  pipeline.from_youtube("https://youtube.com/watch?v=xxx")
  pipeline.from_github("https://github.com/numpy/numpy")
  pipeline.from_web("https://distill.pub/2016/misread-tsne/")
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .chunker import Chunker, Strategy
from .extractors import BookExtractor, GitHubExtractor, RawSource, WebExtractor, YouTubeExtractor
from .generator import Generator
from .normaliser import Normaliser
from .pipeline_stages import (
    CATALOG_PATH,
    CatalogMerger,
    DedupChecker,
    RetryOrchestrator,
    ReviewQueue,
    Validator,
)
from .structure import BookStructureDetector, enrich_chunks_with_structure

# ─────────────────────────────────────────────────────────────────────────────
# Run summary
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RunSummary:
    source_label:   str   = ""
    chunks_total:   int   = 0
    chunks_skipped: int   = 0   # too thin, too code-dense, etc.
    generated:      int   = 0
    duplicates:     int   = 0
    approved:       int   = 0
    rejected:       int   = 0
    pending:        int   = 0
    cost_usd:       float = 0.0

    def print(self):
        print(f"""
  ┌─ Run summary: {self.source_label}
  │  Chunks:    {self.chunks_total} found, {self.chunks_skipped} skipped
  │  Generated: {self.generated}
  │  Dedup:     {self.duplicates} duplicates removed
  │  Approved:  {self.approved}
  │  Rejected:  {self.rejected}
  │  Pending:   {self.pending} (in data/pending_review.json)
  └─ Est. cost: ${self.cost_usd:.3f}
""")


# ─────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────────────────

class IngestionPipeline:
    """
    One pipeline instance per ingestion run.

    Shared state: the DedupChecker is seeded from the existing catalog
    at construction time. It also tracks problems approved in this run
    so intra-run duplicates are caught even before they hit the file.

    The ReviewQueue is also shared across sources — you can batch
    multiple sources and do one review pass at the end.
    """

    def __init__(self,
                 model:        str,
                 api_key:      str | None,
                 chapter:      str,
                 title:        str         = "",
                 catalog_path: Path        = CATALOG_PATH,
                 auto_commit:  bool        = False,
                 max_chunks:   int         = 50,
                 base_url:     str | None  = None,
                 qdrant_router: object | None = None,
                 graph_layer: object | None = None):

        self.chapter      = chapter
        self.title        = title or chapter
        self.max_chunks   = max_chunks
        self.auto_commit  = auto_commit
        self._summary     = RunSummary()
        self._qdrant_router = qdrant_router
        self._graph_layer = graph_layer

        # Load catalog once for dedup seeding
        catalog = json.loads(catalog_path.read_text()) \
                  if catalog_path.exists() \
                  else {"chapters": [], "problems": []}
        self._existing_count = len(catalog.get("problems", []))

        # Shared components
        self._normaliser = Normaliser()
        self._chunker    = Chunker()
        self._generator  = Generator(model, api_key, base_url)
        self._validator  = Validator()
        self._retry      = RetryOrchestrator(self._generator, self._validator)
        self._dedup      = DedupChecker(catalog)
        self._queue      = ReviewQueue(self._validator)
        self._merger     = CatalogMerger(catalog_path)

    # ── Public entry points ───────────────────────────────────────────────────

    def from_pdf(self, path: str, book_title: str = ""):
        """Ingest a PDF book with full structural analysis."""
        print(f"\n📚 Ingesting PDF: {path}")
        raw = BookExtractor.extract(path, title=book_title)
        self._run(raw, strategy=Strategy.HIERARCHICAL,
                  use_structure=True,
                  source_label=Path(path).name)

    def from_latex(self, path: str, book_title: str = ""):
        """Ingest a LaTeX source file (math preserved perfectly)."""
        print(f"\n📐 Ingesting LaTeX: {path}")
        raw = BookExtractor.extract(path, title=book_title)
        self._run(raw, strategy=Strategy.HIERARCHICAL,
                  use_structure=True,
                  source_label=Path(path).name)

    def from_youtube(self, url: str, model_size: str = "base"):
        """Ingest a single YouTube video."""
        print(f"\n🎥 Ingesting YouTube: {url}")
        extractor = YouTubeExtractor(model_size=model_size)
        raw = extractor.extract_video(url)
        title = raw.metadata.get("title", url)
        print(f"   Title: {title}")
        print(f"   Duration: {raw.metadata.get('duration', 0):.0f}s")
        self._run(raw, strategy=Strategy.FLAT_SEMANTIC,
                  use_structure=False,
                  source_label=title[:60])

    def from_playlist(self, url: str, model_size: str = "base"):
        """
        Ingest a YouTube playlist — one problem set per video.
        Each video becomes a sub-chapter numbered within the main chapter.
        """
        print(f"\n📺 Ingesting playlist: {url}")
        extractor = YouTubeExtractor(model_size=model_size)
        sources   = extractor.extract_playlist(url)
        print(f"   Found {len(sources)} videos")
        for i, raw in enumerate(sources, 1):
            title = raw.metadata.get("title", f"Video {i}")
            print(f"\n   [{i}/{len(sources)}] {title}")
            self._run(raw, strategy=Strategy.FLAT_SEMANTIC,
                      use_structure=False,
                      source_label=title[:60])

    def from_github(self, url_or_path: str, mode: str = "full",
                    branch: str = "main"):
        """Ingest a GitHub repository or local code directory."""
        print(f"\n🐙 Ingesting GitHub: {url_or_path}")
        raw = GitHubExtractor.extract(url_or_path, mode=mode, branch=branch)
        print(f"   Repo: {raw.metadata.get('repo', '')}")
        self._run(raw, strategy=Strategy.HYBRID,
                  use_structure=False,
                  source_label=raw.metadata.get("repo", "repo"))

    def from_web(self, url: str):
        """Ingest a single web article, blog post, or arXiv paper."""
        print(f"\n🌐 Ingesting: {url}")
        raw = WebExtractor.extract_url(url)
        title = raw.metadata.get("title", url)
        print(f"   Title: {title}")
        self._run(raw, strategy=Strategy.FLAT_SEMANTIC,
                  use_structure=False,
                  source_label=title[:60])

    def from_web_series(self, urls: list[str], series_title: str = ""):
        """Ingest a series of related articles as one document."""
        print(f"\n📰 Ingesting series: {series_title or 'web series'}")
        raw = WebExtractor.extract_list(urls, series_title=series_title)
        self._run(raw, strategy=Strategy.HIERARCHICAL,
                  use_structure=False,
                  source_label=series_title or "web-series")

    def flush(self):
        """
        Merge all approved problems into the catalog.
        Call this once after all from_* calls are done.
        """
        self._queue.flush_pending()
        self._merger.merge(
            self._queue.approved,
            self.chapter,
            self.title,
            auto_commit=self.auto_commit,
        )
        self._summary.approved = len(self._queue.approved)
        self._summary.pending  = len(self._queue.pending)
        self._summary.print()

    # ── Internal pipeline ─────────────────────────────────────────────────────

    def _run(self, raw: RawSource, strategy: Strategy,
             use_structure: bool, source_label: str):

        self._summary.source_label = source_label

        # Stage 2: normalise
        doc = Normaliser.normalise(raw.text,
                                   source_type=raw.source_type,
                                   metadata=raw.metadata)

        # Stage 3: structure detection (books only)
        chunks = self._chunker.chunk(doc, strategy=strategy)

        if use_structure:
            try:
                title = raw.metadata.get("title", "")
                book  = BookStructureDetector.detect(doc.text, title=title)
                chunks = enrich_chunks_with_structure(chunks, book)
                print(f"   Structure: {len(book.chapters)} chapters, "
                      f"{book.total_exercises} exercises, "
                      f"{book.total_theorems} theorems")
            except Exception as e:
                print(f"   Structure detection failed: {e} — continuing without")

        # Index chunks into Qdrant if router is available
        if self._qdrant_router is not None and hasattr(self._qdrant_router, 'index_chunks'):
            try:
                chunk_dicts = []
                for c in chunks:
                    chunk_dicts.append({
                        "text": c.text,
                        "source_id": raw.metadata.get("source_id", self.chapter),
                        "chunk_index": getattr(c, 'index', 0),
                        "page_or_timestamp": raw.metadata.get("page"),
                    })
                indexed = self._qdrant_router.index_chunks(chunk_dicts)
                print(f"   Indexed {len(indexed)} chunks into Qdrant")
            except Exception as e:
                print(f"   Qdrant indexing failed: {e}")

        # Filter and cap
        usable = [c for c in chunks if not c.is_thin()]
        self._summary.chunks_total   += len(chunks)
        self._summary.chunks_skipped += len(chunks) - len(usable)
        usable = usable[:self.max_chunks]

        print(f"   Chunks: {len(usable)} usable of {len(chunks)} total")

        # Problem number base
        base_n = self._existing_count + self._summary.generated + 1

        for i, chunk in enumerate(usable):
            n = base_n + i
            chapter_display = (chunk.chapter_title or self.chapter)[:40]
            section_display = (chunk.section_title or "")[:40]
            print(f"\n  [{i+1}/{len(usable)}] chapter={chapter_display!r} "
                  f"section={section_display!r} "
                  f"words={chunk.word_count} "
                  f"math={chunk.has_math}")

            # Stages 5–7: generate + validate + retry
            problem, result = self._retry.run(chunk, self.chapter, n)

            if problem is None:
                print("    ✗ Exhausted retries — skipping")
                self._summary.rejected += 1
                continue

            self._summary.generated += 1

            # Extract concepts and link into Kuzu if graph layer is available
            if self._graph_layer is not None and hasattr(self._graph_layer, 'extract_and_link_concepts'):
                try:
                    tags = getattr(problem, 'tags', []) or []
                    if tags:
                        from app.domain.graph import ConceptCandidate
                        candidates = []
                        for tag in tags:
                            if isinstance(tag, str):
                                candidates.append(ConceptCandidate(name=tag))
                        if candidates:
                            source_id = raw.metadata.get("source_id", self.chapter)
                            self._graph_layer.extract_and_link_concepts(source_id, candidates)
                            print(f"      Linked {len(candidates)} concepts into Knowledge Graph")
                except Exception as e:
                    print(f"      Kuzu concept linking failed: {e}")

            # Stage 8: dedup
            is_dup, dup_reason = self._dedup.is_duplicate(problem)
            if is_dup:
                print(f"    ⊘ Duplicate: {dup_reason}")
                self._summary.duplicates += 1
                continue

            # Stage 9: review queue
            self._queue.review(problem, result)

            if problem in self._queue.approved:
                self._dedup.register(problem)  # track for intra-run dedup


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: exercise-first mode for maths books
# ─────────────────────────────────────────────────────────────────────────────

class ExerciseFirstPipeline(IngestionPipeline):
    """
    For deep maths books: extract exercises verbatim first,
    then generate problems from them before touching section text.

    This gives the highest quality problems because the book author
    already designed the exercise — we just wrap it in our schema.

    Priority order:
      1. Book exercises (verbatim)
      2. Worked examples (adapt to new numbers)
      3. Theorem sections (generate understanding tests)
      4. Regular section text (fill gaps)
    """

    def from_pdf_exercise_first(self, path: str, book_title: str = ""):
        print(f"\n📚 Exercise-first ingestion: {path}")
        raw = BookExtractor.extract(path, title=book_title)
        doc = Normaliser.normalise(raw.text, source_type="book",
                                   metadata=raw.metadata)

        # Detect full book structure
        book = BookStructureDetector.detect(doc.text,
                                             title=raw.metadata.get("title", ""))

        print(f"   Found: {len(book.chapters)} chapters, "
              f"{book.total_exercises} exercises, "
              f"{book.total_theorems} theorems")

        # Process exercises first
        for ch in book.chapters:
            all_exercises = list(ch.exercises)
            for topic in ch.topics:
                all_exercises.extend(topic.exercises)

            if all_exercises:
                print(f"\n  Chapter {ch.number}: {ch.title}")
                print(f"    Processing {len(all_exercises)} exercises...")
                self._process_exercises(
                    all_exercises,
                    chapter_title=ch.title or "",
                    difficulty=ch.difficulty_hint,
                )

        # Then process regular content for gaps
        print("\n  Processing section text for gaps...")
        chunks = self._chunker.chunk(doc, strategy=Strategy.HIERARCHICAL)
        chunks = enrich_chunks_with_structure(chunks, book)
        # Only use chunks from sections that have no exercises
        gap_chunks = [
            c for c in chunks
            if not c.has_exercise and not c.is_thin()
        ][:self.max_chunks // 2]  # cap at half max for gap-filling

        base_n = self._existing_count + self._summary.generated + 1
        for i, chunk in enumerate(gap_chunks):
            problem, result = self._retry.run(chunk, self.chapter,
                                              base_n + i)
            if problem and not self._dedup.is_duplicate(problem)[0]:
                self._queue.review(problem, result)
                if problem in self._queue.approved:
                    self._dedup.register(problem)
                    self._summary.generated += 1

    def _process_exercises(self, exercises, chapter_title: str,
                            difficulty: str):
        """Turn verbatim book exercises into GeneratedProblems."""
        from .chunker import Chunk

        base_n = self._existing_count + self._summary.generated + 1

        for i, ex in enumerate(exercises[:self.max_chunks]):
            # Construct a synthetic chunk from the exercise text
            # Append the book hint if available
            text = ex.text
            if ex.hint:
                text += f"\n\nBook hint: {ex.hint}"

            chunk = Chunk(
                text          = text,
                chapter_title = chapter_title,
                section_title = f"Exercise {ex.number}",
                has_math      = any(marker in text
                                    for marker in ["$", "\\", "matrix",
                                                   "vector", "integral"]),
                has_code      = "```" in text,
                has_exercise  = True,
                source_type   = "book",
                word_count    = len(text.split()),
                metadata      = {
                    "exercise_number": ex.number,
                    "difficulty":      difficulty,
                    "source_ref":      f"Ex. {ex.number}",
                }
            )

            if chunk.is_thin():
                continue

            print(f"      Ex {ex.number}...", end=" ", flush=True)
            problem, result = self._retry.run(chunk, self.chapter,
                                              base_n + i)
            if problem is None:
                print("✗")
                continue

            self._summary.generated += 1

            is_dup, reason = self._dedup.is_duplicate(problem)
            if is_dup:
                print("⊘ dup")
                self._summary.duplicates += 1
                continue

            self._queue.review(problem, result)
            if problem in self._queue.approved:
                self._dedup.register(problem)
