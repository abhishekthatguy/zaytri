"""
Zaytri — CLI RAG Commands
Typer-based CLI for RAG pipeline observability, testing, and debugging.

Commands:
    zaytri rag-check  --brand <name>           Check embedding health
    zaytri rag-test   --brand <name> --query   Test retrieval
    zaytri rag-debug  --brand <name> --query   Full debug pipeline
    zaytri demo       <brand>                  Deterministic demo run
"""

import asyncio
import sys
import time
from typing import Optional

# ─── Register Models ─────────────────────────────────────────────────────────
# We import all models at the module level so SQLAlchemy correctly registers 
# relationships (e.g. SocialConnection <-> BrandSettings) before they are used.
import auth.models  # noqa: F401
import db.models     # noqa: F401
import db.settings_models  # noqa: F401
import db.social_connections  # noqa: F401
import db.whatsapp_approval   # noqa: F401
import db.calendar_models     # noqa: F401
import db.task_models          # noqa: F401

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
        table.add_row("Status", "[green]✓ Healthy[/green]" if report.is_healthy else "[red]✗ Unhealthy[/red]")
        table.add_row("Knowledge Sources (Total)", str(report.total_knowledge_sources))
        table.add_row("Knowledge Sources (Active)", str(report.active_knowledge_sources))
        table.add_row("Content Items", str(report.total_content_items))
        table.add_row("Total Retrievable Chunks", str(report.total_chunks))
        table.add_row("Has Brand Guidelines", "✓" if report.has_brand_guidelines else "✗")
        table.add_row("Has Target Audience", "✓" if report.has_target_audience else "✗")
        table.add_row("Has Brand Tone", "✓" if report.has_brand_tone else "✗")

        console.print(table)

        if report.sample_metadata:
            console.print()
            console.print("[cyan]Sample Knowledge Sources:[/cyan]")
            for meta in report.sample_metadata:
                name = meta.get('source_name', 'Unknown')
                type_ = meta.get('source_type', 'Unknown')
                v_count = meta.get('vector_count', 0)
                console.print(f"  • [white]{name}[/white] ({type_}) — vectors: {v_count}")
                
                preview = meta.get('summary_preview') or meta.get('chunk_preview')
                if preview:
                    console.print(f"    [dim]{preview}...[/dim]")

        if report.error:
            console.print(f"\n[red]Error: {report.error}[/red]")

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


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    """CLI entry point — called from the bash launcher."""
    app()


if __name__ == "__main__":
    main()
