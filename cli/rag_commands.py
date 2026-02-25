"""
Zaytri — CLI RAG Commands
Typer-based CLI for RAG pipeline observability, testing, and debugging.

Commands:
    zaytri rag-check  --brand <name>           Check embedding health
    zaytri rag-test   --brand <name> --query   Test retrieval
    zaytri rag-debug  --brand <name> --query   Full debug pipeline
    zaytri demo       <brand>                  Deterministic demo run
    zaytri embed      --brand <name>           Generate embeddings
    zaytri echo                                Full system diagnostic
    zaytri db-inspect                          Direct DB content verification
"""

import asyncio
import os
import sys
import time

# ─── Ensure project root is on sys.path ──────────────────────────────────────
# Allows running directly: python3 cli/rag_commands.py ...
# Without this, imports like `auth`, `db`, `brain` fail.
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
from typing import Optional

# ─── Register ALL Models (MUST be before any DB session usage) ───────────────
# This single import ensures all SQLAlchemy models are loaded in correct
# dependency order and all relationship() references are eagerly resolved.
# Without this, you get: sqlalchemy.exc.InvalidRequestError (gkpj)
import db.register_models  # noqa: F401

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

app = typer.Typer(
    name="zaytri-rag",
    help="Zaytri RAG Pipeline CLI — observability, testing, and debugging",
    no_args_is_help=True,
)
console = Console()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _run_async(coro):
    """Run an async function from sync context."""
    return asyncio.run(coro)


async def _resolve_brand_id(brand_name: str) -> Optional[str]:
    """Resolve brand name to brand_id from the database."""
    from sqlalchemy import select
    from db.database import async_session
    from db.settings_models import BrandSettings

    async with async_session() as session:
        result = await session.execute(
            select(BrandSettings).where(
                BrandSettings.brand_name.ilike(f"%{brand_name}%")
            )
        )
        brand = result.scalars().first()
        if brand:
            return str(brand.id), brand.brand_name
        return None, None


def _print_header(title: str):
    """Print a styled header."""
    console.print()
    console.print(Panel(
        Text(title, style="bold cyan", justify="center"),
        border_style="cyan",
        padding=(0, 2),
    ))


def _print_separator():
    console.print("─" * 60, style="dim")


# ─── rag-check ───────────────────────────────────────────────────────────────

@app.command("rag-check")
def rag_check(
    brand: str = typer.Option(..., "--brand", "-b", help="Brand name to check"),
):
    """Check embedding/knowledge health for a brand."""
    _print_header("RAG HEALTH CHECK")

    async def _check():
        brand_id, brand_name = await _resolve_brand_id(brand)
        if not brand_id:
            console.print(f"[red]✗ Brand '{brand}' not found in database.[/red]")
            console.print("[dim]Available brands can be viewed in the Settings → Brands page.[/dim]")
            raise typer.Exit(1)

        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()
        report = await engine.check_embedding_health(brand_id)

        # Display
        table = Table(title=f"Health Report: {report.brand_name}", show_header=False, padding=(0, 2))
        table.add_column("Metric", style="cyan", width=30)
        table.add_column("Value", style="white")

        table.add_row("Brand ID", report.brand_id[:16] + "...")
        table.add_row("Brand Name", report.brand_name)

        if report.is_healthy:
            table.add_row("Status", "[green]✓ Healthy — Vectors Ready[/green]")
        elif report.active_knowledge_sources > 0:
            table.add_row("Status", "[yellow]⚠ Sources Present, No Vectors[/yellow]")
        else:
            table.add_row("Status", "[red]✗ No Knowledge Sources[/red]")

        table.add_row("Knowledge Sources (Total)", str(report.total_knowledge_sources))
        table.add_row("Knowledge Sources (Active)", str(report.active_knowledge_sources))
        table.add_row("Vector Embeddings", str(report.total_embeddings) if report.total_embeddings > 0 else "[red]0 — Run embed command![/red]")
        table.add_row("Content Items", str(report.total_content_items))
        table.add_row("Has Brand Guidelines", "✓" if report.has_brand_guidelines else "✗")
        table.add_row("Has Target Audience", "✓" if report.has_target_audience else "✗")
        table.add_row("Has Brand Tone", "✓" if report.has_brand_tone else "✗")

        console.print(table)

        if report.sample_metadata:
            console.print()
            console.print("[cyan]Knowledge Sources:[/cyan]")
            for meta in report.sample_metadata:
                name = meta.get('source_name', 'Unknown')
                type_ = meta.get('source_type', 'Unknown')
                v_count = meta.get('vector_count', 0)
                has_content = meta.get('has_content', False)

                vec_status = f"[green]{v_count} vectors[/green]" if v_count > 0 else "[red]0 vectors[/red]"
                content_status = "[green]has content[/green]" if has_content else "[yellow]empty[/yellow]"

                console.print(f"  • [white]{name}[/white] ({type_}) — {vec_status}, {content_status}")
                
                preview = meta.get('summary_preview') or meta.get('chunk_preview')
                if preview:
                    console.print(f"    [dim]{preview}...[/dim]")

        if report.error:
            console.print(f"\n[red]Error: {report.error}[/red]")

        if not report.is_healthy and report.active_knowledge_sources > 0:
            console.print()
            console.print(Panel(
                f'[bold yellow]Fix:[/bold yellow] python3 cli/rag_commands.py embed --brand "{report.brand_name}"',
                title="[bold yellow]⚠ Missing Embeddings[/bold yellow]",
                border_style="yellow",
            ))

    _run_async(_check())


# ─── rag-test ────────────────────────────────────────────────────────────────

@app.command("rag-test")
def rag_test(
    brand: str = typer.Option(..., "--brand", "-b", help="Brand name"),
    query: str = typer.Option(..., "--query", "-q", help="Test query"),
):
    """Test retrieval for a brand with a specific query."""
    _print_header("RAG RETRIEVAL TEST")

    async def _test():
        brand_id, brand_name = await _resolve_brand_id(brand)
        if not brand_id:
            console.print(f"[red]✗ Brand '{brand}' not found.[/red]")
            raise typer.Exit(1)

        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()
        result = await engine.test_retrieval(brand_id, query)

        # Display
        table = Table(show_header=False, padding=(0, 2))
        table.add_column("", style="cyan", width=25)
        table.add_column("", style="white")

        table.add_row("Brand", result.brand_name)
        table.add_row("Namespace", result.namespace)
        table.add_row("Query", query)
        table.add_row("Top K", str(result.top_k))
        table.add_row("Total Embeddings", str(result.total_embeddings))
        table.add_row("Retrieved Docs", str(len(result.retrieved_chunks)))
        table.add_row("Scores", str(result.similarity_scores))
        table.add_row("Sufficient Context", "[green]Yes[/green]" if result.is_sufficient else "[red]No[/red]")
        table.add_row("Retrieval Time", f"{result.retrieval_time_ms:.1f}ms")

        console.print(table)

        if result.retrieved_chunks:
            console.print()
            console.print("[cyan]Retrieved Chunks:[/cyan]")
            for i, chunk in enumerate(result.retrieved_chunks, 1):
                score_color = "green" if chunk.similarity_score >= 0.6 else "yellow" if chunk.similarity_score >= 0.3 else "red"
                console.print(f"  [{score_color}]{i}. [{chunk.similarity_score:.4f}][/{score_color}] {chunk.source_name} ({chunk.source_type})")
                preview = chunk.content[:150] + "..." if len(chunk.content) > 150 else chunk.content
                console.print(f"     [dim]{preview}[/dim]")
        else:
            console.print("\n[yellow]⚠ No documents retrieved.[/yellow]")

        if result.warning:
            console.print(f"\n[yellow]Warning: {result.warning}[/yellow]")

    _run_async(_test())


# ─── rag-debug ───────────────────────────────────────────────────────────────

@app.command("rag-debug")
def rag_debug(
    brand: str = typer.Option(..., "--brand", "-b", help="Brand name"),
    query: str = typer.Option(..., "--query", "-q", help="Debug query"),
    force_rag: bool = typer.Option(False, "--force-rag", help="Block LLM without sufficient context"),
    deterministic: bool = typer.Option(False, "--deterministic", help="Set temperature=0"),
):
    """Full RAG pipeline debug with structured report."""
    _print_header("RAG DEBUG REPORT")

    async def _debug():
        brand_id, brand_name = await _resolve_brand_id(brand)
        if not brand_id:
            console.print(f"[red]✗ Brand '{brand}' not found.[/red]")
            raise typer.Exit(1)

        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()
        debug = await engine.run_debug_pipeline(
            brand_id=brand_id,
            query=query,
            force_rag=force_rag,
            deterministic=deterministic,
        )

        # ═══ Display Report ═══
        console.print("=" * 50, style="cyan")
        console.print(f"  [bold cyan]Brand:[/bold cyan]           {debug['brand']}")
        console.print(f"  [bold cyan]Namespace:[/bold cyan]       {debug['namespace']}")
        console.print(f"  [bold cyan]Total Embeddings:[/bold cyan] {debug['total_embeddings']}")
        console.print(f"  [bold cyan]Retrieved Docs:[/bold cyan]   {debug['retrieved_docs']}")
        console.print(f"  [bold cyan]Similarity Scores:[/bold cyan] {debug['similarity_scores']}")
        console.print(f"  [bold cyan]Sufficient:[/bold cyan]       {'✓ Yes' if debug['is_sufficient'] else '✗ No'}")
        console.print(f"  [bold cyan]Force RAG:[/bold cyan]        {'On' if debug['force_rag'] else 'Off'}")
        console.print(f"  [bold cyan]Deterministic:[/bold cyan]    {'On' if debug['deterministic'] else 'Off'}")
        console.print()

        # Chunk previews
        if debug['chunks_preview']:
            console.print("[cyan]  Retrieved Chunk Preview:[/cyan]")
            for preview in debug['chunks_preview']:
                console.print(f"  - [dim]{preview}[/dim]")
            console.print()

        # Prompt
        console.print("[cyan]  Prompt Sent to LLM:[/cyan]")
        console.print("  " + "─" * 46)
        for line in debug['system_prompt'].split('\n'):
            console.print(f"  [dim]{line}[/dim]")
        console.print("  " + "─" * 46)
        console.print()

        # Health
        health = debug['health']
        console.print("[cyan]  Knowledge Health:[/cyan]")
        console.print(f"    Sources: {health['knowledge_sources']} (active: {health['active_sources']})")
        console.print(f"    Content Items: {health['content_items']}")
        console.print(f"    Guidelines: {'✓' if health['has_guidelines'] else '✗'}")
        console.print(f"    Target Audience: {'✓' if health['has_audience'] else '✗'}")
        console.print()

        # Latency
        latency = debug['latency']
        console.print("[cyan]  Latency:[/cyan]")
        console.print(f"    Retrieval:       {latency['retrieval_ms']:.1f}ms")
        console.print(f"    Context Build:   {latency['context_build_ms']:.1f}ms")
        console.print(f"    Total Pipeline:  {latency['total_pipeline_ms']:.1f}ms")

        if debug['warning']:
            console.print(f"\n  [yellow]⚠ {debug['warning']}[/yellow]")

        console.print("=" * 50, style="cyan")

    _run_async(_debug())


# ─── demo ────────────────────────────────────────────────────────────────────

@app.command("demo")
def demo(
    brand: str = typer.Argument(..., help="Brand name for demo"),
):
    """Run a deterministic demo of the RAG pipeline."""
    _print_header(f"ZAYTRI RAG DEMO — {brand.upper()}")

    demo_queries = [
        f"What is {brand}?",
        f"Tell me about {brand}'s target audience",
        f"What are the brand guidelines for {brand}?",
    ]

    async def _demo():
        brand_id, brand_name = await _resolve_brand_id(brand)
        if not brand_id:
            console.print(f"[red]✗ Brand '{brand}' not found.[/red]")
            raise typer.Exit(1)

        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()

        console.print(f"[cyan]Running {len(demo_queries)} test queries in deterministic mode...[/cyan]\n")

        for i, q in enumerate(demo_queries, 1):
            console.print(f"[bold white]Query {i}:[/bold white] {q}")
            _print_separator()

            result = await engine.test_retrieval(brand_id, q)

            console.print(f"  Retrieved: {len(result.retrieved_chunks)} docs")
            console.print(f"  Scores: {result.similarity_scores}")
            console.print(f"  Sufficient: {'✓' if result.is_sufficient else '✗'}")
            console.print(f"  Time: {result.retrieval_time_ms:.1f}ms")

            if result.retrieved_chunks:
                top = result.retrieved_chunks[0]
                preview = top.content[:120] + "..." if len(top.content) > 120 else top.content
                console.print(f"  Top Match: [dim]{preview}[/dim]")
            
            if not result.is_sufficient:
                console.print("  [yellow]→ Would block LLM in force-rag mode[/yellow]")

            console.print()

        console.print("[green]✓ Demo complete.[/green]")

    _run_async(_demo())


# ─── embed ───────────────────────────────────────────────────────────────────

@app.command("embed")
def embed(
    brand: str = typer.Option(..., "--brand", "-b", help="Brand name to embed"),
):
    """Generate and store vector embeddings for a brand's knowledge."""
    _print_header("EMBEDDING GENERATION")

    async def _embed():
        brand_id, brand_name = await _resolve_brand_id(brand)
        if not brand_id:
            console.print(f"[red]✗ Brand '{brand}' not found.[/red]")
            raise typer.Exit(1)

        console.print(f"[cyan]Brand:[/cyan] {brand_name}")
        console.print(f"[cyan]Generating embeddings...[/cyan]\n")

        from brain.rag_engine import get_rag_engine
        engine = get_rag_engine()
        result = await engine.embed_brand_knowledge(brand_id)

        table = Table(show_header=False, padding=(0, 2))
        table.add_column("", style="cyan", width=25)
        table.add_column("", style="white")

        table.add_row("Embedded", str(result["embedded"]))
        table.add_row("Skipped (duplicates)", str(result["skipped"]))
        table.add_row("Errors", str(result["errors"]))
        table.add_row("Time", f"{result['time_ms']:.1f}ms")

        console.print(table)

        if result["embedded"] > 0:
            console.print(f"\n[green]✓ {result['embedded']} embeddings stored in pgvector.[/green]")
        elif result["skipped"] > 0:
            console.print(f"\n[yellow]All documents already embedded (skipped {result['skipped']}).[/yellow]")
        else:
            console.print("\n[yellow]⚠ No documents found to embed. Add knowledge sources or brand guidelines first.[/yellow]")

    _run_async(_embed())


# ─── echo (System Diagnostic) ───────────────────────────────────────────────

@app.command("echo")
def echo():
    """
    Full system diagnostic — test DB, brands, embeddings, and knowledge base.
    Run this to verify the entire pipeline is healthy.
    """
    _print_header("ZAYTRI SYSTEM ECHO — Full Diagnostic")

    async def _echo():
        from sqlalchemy import select, func, text
        from db.database import async_session
        from db.settings_models import BrandSettings, KnowledgeSource, DocumentEmbedding
        from auth.models import User, UserPlan

        async with async_session() as session:

            # ══════════════════════════════════════════════════════════
            # 1. DATABASE CONNECTIVITY
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]1. DATABASE CONNECTIVITY[/bold cyan]")
            _print_separator()
            try:
                result = await session.execute(text("SELECT version()"))
                pg_version = result.scalar()
                console.print(f"  [green]✓[/green] PostgreSQL connected")
                console.print(f"  [dim]{pg_version}[/dim]")

                # Check pgvector
                try:
                    await session.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'"))
                    vec_row = (await session.execute(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'"))).scalar()
                    if vec_row:
                        console.print(f"  [green]✓[/green] pgvector extension: v{vec_row}")
                    else:
                        console.print(f"  [yellow]⚠[/yellow] pgvector extension not installed")
                except Exception:
                    console.print(f"  [yellow]⚠[/yellow] pgvector check failed")
            except Exception as e:
                console.print(f"  [red]✗ Database connection failed: {e}[/red]")
                return

            # ══════════════════════════════════════════════════════════
            # 2. USERS & PLANS
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]2. USERS & PLANS[/bold cyan]")
            _print_separator()
            users = (await session.execute(select(User))).scalars().all()
            if users:
                user_table = Table(show_header=True, padding=(0, 1))
                user_table.add_column("Username", style="white")
                user_table.add_column("Email", style="dim")
                user_table.add_column("Plan", style="cyan")
                user_table.add_column("Admin", style="yellow")
                user_table.add_column("Active", style="green")

                for u in users:
                    plan_val = u.plan.value if hasattr(u.plan, 'value') else str(u.plan or 'free')
                    plan_style = "bold magenta" if plan_val == "pro" else "cyan"
                    user_table.add_row(
                        u.username,
                        u.email,
                        f"[{plan_style}]{plan_val}[/{plan_style}]",
                        "✓" if u.is_admin else "✗",
                        "✓" if u.is_active else "✗",
                    )
                console.print(user_table)
            else:
                console.print("  [yellow]⚠ No users found[/yellow]")

            # ══════════════════════════════════════════════════════════
            # 3. BRANDS
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]3. BRANDS[/bold cyan]")
            _print_separator()
            brands = (await session.execute(select(BrandSettings))).scalars().all()
            if brands:
                brand_table = Table(show_header=True, padding=(0, 1))
                brand_table.add_column("#", style="dim", width=3)
                brand_table.add_column("Brand Name", style="bold white")
                brand_table.add_column("ID (short)", style="dim")
                brand_table.add_column("Tone", style="cyan")
                brand_table.add_column("Audience", style="yellow")
                brand_table.add_column("Guidelines", style="green")

                for i, b in enumerate(brands, 1):
                    brand_table.add_row(
                        str(i),
                        b.brand_name,
                        str(b.id)[:8] + "...",
                        (b.brand_tone or "—")[:30],
                        (b.target_audience or "—")[:30],
                        "✓" if b.brand_guidelines else "✗",
                    )
                console.print(brand_table)
            else:
                console.print("  [yellow]⚠ No brands configured. Create one in Settings → Brands.[/yellow]")

            # ══════════════════════════════════════════════════════════
            # 4. KNOWLEDGE SOURCES
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]4. KNOWLEDGE SOURCES[/bold cyan]")
            _print_separator()
            sources = (await session.execute(select(KnowledgeSource))).scalars().all()
            if sources:
                kb_table = Table(show_header=True, padding=(0, 1))
                kb_table.add_column("#", style="dim", width=3)
                kb_table.add_column("Name", style="white")
                kb_table.add_column("Type", style="cyan")
                kb_table.add_column("Brand", style="yellow")
                kb_table.add_column("Active", style="green")
                kb_table.add_column("Content Preview", style="dim", max_width=40)

                for i, src in enumerate(sources, 1):
                    # Resolve brand name
                    brand_name = "—"
                    if src.brand_id:
                        brand_row = (await session.execute(
                            select(BrandSettings.brand_name).where(BrandSettings.id == src.brand_id)
                        )).scalar()
                        brand_name = brand_row or "—"

                    content_preview = (src.content or "")[:40]
                    if len(src.content or "") > 40:
                        content_preview += "..."

                    kb_table.add_row(
                        str(i),
                        src.name,
                        src.source_type or "—",
                        brand_name,
                        "[green]✓[/green]" if src.is_active else "[red]✗[/red]",
                        content_preview or "[dim]empty[/dim]",
                    )
                console.print(kb_table)
            else:
                console.print("  [yellow]⚠ No knowledge sources. Add them in Settings → Knowledge Base.[/yellow]")

            # ══════════════════════════════════════════════════════════
            # 5. EMBEDDINGS DATA
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]5. EMBEDDINGS DATA[/bold cyan]")
            _print_separator()

            total_embeddings = (await session.execute(
                select(func.count(DocumentEmbedding.id))
            )).scalar() or 0

            if total_embeddings > 0:
                emb_table = Table(show_header=True, padding=(0, 1))
                emb_table.add_column("Metric", style="cyan", width=30)
                emb_table.add_column("Value", style="white")

                emb_table.add_row("Total Embeddings", str(total_embeddings))

                # Per-brand breakdown
                brand_counts = (await session.execute(
                    select(
                        BrandSettings.brand_name,
                        func.count(DocumentEmbedding.id)
                    ).join(
                        BrandSettings, DocumentEmbedding.brand_id == BrandSettings.id
                    ).group_by(BrandSettings.brand_name)
                )).all()

                for bname, cnt in brand_counts:
                    emb_table.add_row(f"  └ {bname}", str(cnt))

                # Provider breakdown
                provider_counts = (await session.execute(
                    select(
                        DocumentEmbedding.embedding_provider,
                        func.count(DocumentEmbedding.id)
                    ).group_by(DocumentEmbedding.embedding_provider)
                )).all()

                emb_table.add_row("", "")
                emb_table.add_row("[bold]By Provider[/bold]", "")
                for prov, cnt in provider_counts:
                    icon = "💎" if prov == "openai" else "🆓"
                    emb_table.add_row(f"  {icon} {prov or 'unknown'}", str(cnt))

                # Model breakdown
                model_counts = (await session.execute(
                    select(
                        DocumentEmbedding.embedding_model,
                        func.count(DocumentEmbedding.id)
                    ).group_by(DocumentEmbedding.embedding_model)
                )).all()

                emb_table.add_row("", "")
                emb_table.add_row("[bold]By Model[/bold]", "")
                for model, cnt in model_counts:
                    emb_table.add_row(f"  {model or 'unknown'}", str(cnt))

                # Sample embedding
                sample = (await session.execute(
                    select(DocumentEmbedding).limit(1)
                )).scalars().first()

                if sample:
                    emb_table.add_row("", "")
                    emb_table.add_row("[bold]Sample Embedding[/bold]", "")
                    emb_table.add_row("  Source", sample.source_name)
                    emb_table.add_row("  Type", sample.source_type)
                    emb_table.add_row("  Dimension", str(sample.embedding_dimension))
                    emb_table.add_row("  Provider", sample.embedding_provider or "unknown")
                    emb_table.add_row("  Model", sample.embedding_model or "unknown")
                    preview = (sample.chunk_text or "")[:80]
                    if len(sample.chunk_text or "") > 80:
                        preview += "..."
                    emb_table.add_row("  Text Preview", f"[dim]{preview}[/dim]")

                console.print(emb_table)
            else:
                console.print("  [yellow]⚠ No embeddings stored. Run: zaytri embed --brand <name>[/yellow]")

            # ══════════════════════════════════════════════════════════
            # 6. EMBEDDING PROVIDER TEST
            # ══════════════════════════════════════════════════════════
            console.print("\n[bold cyan]6. EMBEDDING PROVIDER TEST[/bold cyan]")
            _print_separator()

            try:
                from brain.embeddings import get_embedding_provider, EMBEDDING_DIMENSION

                provider = get_embedding_provider(user_plan="free")
                console.print(f"  Provider:  [white]{provider.provider_name}[/white]")
                console.print(f"  Model:     [white]{provider.model_name}[/white]")
                console.print(f"  Dimension: [white]{provider.dimension}D[/white]")

                console.print("  [dim]Generating test embedding...[/dim]")
                test_start = time.perf_counter()
                test_vectors = await provider.embed(["Hello, this is a Zaytri echo test."])
                test_ms = (time.perf_counter() - test_start) * 1000

                if test_vectors and len(test_vectors) > 0:
                    vec = test_vectors[0]
                    actual_dim = len(vec)
                    non_zero = sum(1 for v in vec if v != 0.0)
                    console.print(f"  [green]✓[/green] Generated {actual_dim}D vector in {test_ms:.1f}ms")
                    console.print(f"  [dim]  Non-zero dims: {non_zero}/{actual_dim} "
                                  f"(norm: {sum(v*v for v in vec)**0.5:.4f})[/dim]")
                    if actual_dim != EMBEDDING_DIMENSION:
                        console.print(f"  [red]✗ Dimension mismatch! Expected {EMBEDDING_DIMENSION}, got {actual_dim}[/red]")
                    else:
                        console.print(f"  [green]✓[/green] Dimension matches pgvector schema ({EMBEDDING_DIMENSION}D)")
                else:
                    console.print(f"  [red]✗ Empty embedding returned[/red]")
            except Exception as e:
                console.print(f"  [red]✗ Embedding test failed: {e}[/red]")

            # ══════════════════════════════════════════════════════════
            # 7. LIVE RAG RETRIEVAL TEST
            # ══════════════════════════════════════════════════════════
            if brands and total_embeddings > 0:
                console.print("\n[bold cyan]7. LIVE RAG RETRIEVAL TEST[/bold cyan]")
                _print_separator()

                test_brand = brands[0]
                test_query = f"What is {test_brand.brand_name}?"
                console.print(f"  Brand: [white]{test_brand.brand_name}[/white]")
                console.print(f"  Query: [white]{test_query}[/white]")
                console.print("  [dim]Running vector search...[/dim]")

                try:
                    from brain.rag_engine import get_rag_engine
                    engine = get_rag_engine()
                    rag_result = await engine.build_rag_context(
                        brand_id=str(test_brand.id),
                        query=test_query,
                        force_rag=False,
                        session=session,
                    )

                    rag_table = Table(show_header=False, padding=(0, 1))
                    rag_table.add_column("", style="cyan", width=25)
                    rag_table.add_column("", style="white")

                    rag_table.add_row("Retrieved Chunks", str(len(rag_result.retrieved_chunks)))
                    rag_table.add_row("Scores", str(rag_result.similarity_scores))
                    rag_table.add_row("Sufficient Context", "[green]✓ Yes[/green]" if rag_result.is_sufficient else "[yellow]✗ No[/yellow]")
                    rag_table.add_row("Search Method", rag_result.search_method or "—")
                    rag_table.add_row("Retrieval Time", f"{rag_result.retrieval_time_ms:.1f}ms")

                    console.print(rag_table)

                    if rag_result.retrieved_chunks:
                        console.print("  [cyan]Top Match:[/cyan]")
                        top = rag_result.retrieved_chunks[0]
                        preview = top.content[:150] + "..." if len(top.content) > 150 else top.content
                        console.print(f"    [{('green' if top.similarity_score >= 0.5 else 'yellow')}]"
                                      f"[{top.similarity_score:.4f}][/] {top.source_name}")
                        console.print(f"    [dim]{preview}[/dim]")
                except Exception as e:
                    console.print(f"  [red]✗ RAG test failed: {e}[/red]")
            else:
                console.print("\n[bold cyan]7. LIVE RAG RETRIEVAL TEST[/bold cyan]")
                _print_separator()
                if not brands:
                    console.print("  [yellow]⚠ Skipped — no brands configured[/yellow]")
                else:
                    console.print("  [yellow]⚠ Skipped — no embeddings stored[/yellow]")

            # ══════════════════════════════════════════════════════════
            # SUMMARY
            # ══════════════════════════════════════════════════════════
            console.print()
            summary_parts = []
            summary_parts.append(f"[green]✓[/green] DB connected")
            summary_parts.append(f"{len(users)} user(s)")
            summary_parts.append(f"{len(brands)} brand(s)")
            summary_parts.append(f"{len(sources)} knowledge source(s)")
            summary_parts.append(f"{total_embeddings} embedding(s)")
            console.print(Panel(
                " · ".join(summary_parts),
                title="[bold green]Echo Summary[/bold green]",
                border_style="green",
            ))

    _run_async(_echo())


# ─── db-inspect  ─────────────────────────────────────────────────────────────

@app.command("db-inspect")
def db_inspect():
    """
    Direct database inspection — runs raw queries to verify RAG table contents.
    Perform basic checks on embeddings, knowledge sources, and brand settings.
    """
    _print_header("DATABASE CONTENT INSPECTION")

    async def _inspect():
        from sqlalchemy import text
        from db.database import async_session

        async with async_session() as session:
            # 1. Document Embeddings Sample & Count
            console.print("\n[bold cyan]1. Document Embeddings (Last 5 Chunks)[/bold cyan]")
            _print_separator()
            try:
                # Get count
                count_res = await session.execute(text("SELECT COUNT(*) FROM document_embeddings;"))
                total_chunks = count_res.scalar()
                
                # Get sample
                sample_res = await session.execute(text(
                    "SELECT left(chunk_text, 100), source_name FROM document_embeddings "
                    "ORDER BY created_at DESC LIMIT 5;"
                ))
                samples = sample_res.all()

                if samples:
                    table = Table(show_header=True, padding=(0, 1))
                    table.add_column("Source Name", style="cyan")
                    table.add_column("Chunk Preview (100 chars)", style="white", overflow="ellipsis")
                    
                    for chunk, source in samples:
                        table.add_row(source, chunk.replace("\n", " ").strip() + "...")
                    console.print(table)
                else:
                    console.print("  [yellow]No embeddings found.[/yellow]")
                
                console.print(f"\n  [bold]Total Chunks in DB:[/bold] [green]{total_chunks}[/green]")
            except Exception as e:
                console.print(f"  [red]✗ Error querying document_embeddings: {e}[/red]")

            # 2. Knowledge Sources
            console.print("\n[bold cyan]2. Knowledge Sources[/bold cyan]")
            _print_separator()
            try:
                ks_res = await session.execute(text("SELECT id, name, vector_count FROM knowledge_sources;"))
                sources = ks_res.all()

                if sources:
                    table = Table(show_header=True, padding=(0, 1))
                    table.add_column("ID (short)", style="dim")
                    table.add_column("Name", style="white")
                    table.add_column("Vector Count", style="green", justify="right")
                    
                    for kid, name, v_count in sources:
                        table.add_row(str(kid)[:8] + "...", name, str(v_count or 0))
                    console.print(table)
                else:
                    console.print("  [yellow]No knowledge sources found.[/yellow]")
            except Exception as e:
                console.print(f"  [red]✗ Error querying knowledge_sources: {e}[/red]")

            # 3. Brand Settings
            console.print("\n[bold cyan]3. Brand Settings[/bold cyan]")
            _print_separator()
            try:
                brand_res = await session.execute(text("SELECT id, brand_name, user_id FROM brand_settings;"))
                brands = brand_res.all()

                if brands:
                    table = Table(show_header=True, padding=(0, 1))
                    table.add_column("Brand ID (short)", style="dim")
                    table.add_column("Brand Name", style="white")
                    table.add_column("Owner User ID (short)", style="dim")
                    
                    for bid, bname, uid in brands:
                        table.add_row(str(bid)[:8] + "...", bname, str(uid)[:8] + "...")
                    console.print(table)
                else:
                    console.print("  [yellow]No brands found.[/yellow]")
            except Exception as e:
                console.print(f"  [red]✗ Error querying brand_settings: {e}[/red]")

    _run_async(_inspect())


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    """CLI entry point — called from the bash launcher."""
    app()


if __name__ == "__main__":
    main()
