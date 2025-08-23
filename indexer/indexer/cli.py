"""Command-line interface for the indexer."""

import asyncio
import signal
import sys
from typing import Optional
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from structlog import get_logger

from .config import config
from .indexer import IndexerService
from .database import init_db, close_db

logger = get_logger()
console = Console()


class IndexerApp:
    """Main application class."""

    def __init__(self):
        self.indexer: Optional[IndexerService] = None
        self.shutdown_event = asyncio.Event()

    async def initialize(self):
        """Initialize the indexer."""
        try:
            console.print("[blue]Initializing indexer...[/blue]")

            # Initialize database
            await init_db()

            # Initialize indexer
            self.indexer = IndexerService()
            await self.indexer.initialize()

            console.print("[green]✓ Indexer initialized successfully[/green]")

        except Exception as e:
            console.print(f"[red]✗ Initialization failed: {e}[/red]")
            raise

    async def run(self):
        """Run the indexer."""
        try:
            console.print("[blue]Starting indexer service...[/blue]")
            await self.indexer.start()
        except KeyboardInterrupt:
            console.print("[yellow]Received interrupt signal[/yellow]")
        except Exception as e:
            console.print(f"[red]✗ Indexer failed: {e}[/red]")
            raise
        finally:
            await self.shutdown()

    async def shutdown(self):
        """Shutdown the indexer."""
        console.print("[blue]Shutting down indexer...[/blue]")

        if self.indexer:
            await self.indexer.stop()

        await close_db()
        console.print("[green]✓ Shutdown complete[/green]")

    async def get_stats(self):
        """Get and display indexer statistics."""
        if not self.indexer:
            console.print("[red]Indexer not initialized[/red]")
            return

        try:
            stats = await self.indexer.get_stats()

            table = Table(title="Indexer Statistics")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="magenta")

            table.add_row("Total Submissions", str(sum(stats.get("submissions", {}).values())))
            table.add_row("Completed", str(stats.get("submissions", {}).get("completed", 0)))
            table.add_row("Processing", str(stats.get("submissions", {}).get("processing", 0)))
            table.add_row("Failed", str(stats.get("submissions", {}).get("failed", 0)))
            table.add_row("Total Records", str(stats.get("total_records", 0)))
            table.add_row("Last Block", str(stats.get("last_block", 0)))
            table.add_row("Last Updated", str(stats.get("last_updated", "N/A")))

            console.print(table)

        except Exception as e:
            console.print(f"[red]Failed to get stats: {e}[/red]")


@click.group()
@click.option("--log-level", default="INFO", help="Set log level")
@click.pass_context
def cli(ctx, log_level):
    """nweb indexer - Watches blockchain for scan submissions and indexes IPFS bundles."""
    ctx.ensure_object(dict)
    ctx.obj["log_level"] = log_level


@cli.command()
@click.option("--config", help="Path to config file")
@click.pass_context
def run(ctx, config):
    """Run the indexer service."""
    async def run_async():
        app = IndexerApp()

        # Setup signal handlers
        def signal_handler():
            console.print("[yellow]Received shutdown signal...[/yellow]")
            app.shutdown_event.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            asyncio.get_event_loop().add_signal_handler(sig, signal_handler)

        try:
            await app.initialize()

            # Create shutdown task
            shutdown_task = asyncio.create_task(app.shutdown_event.wait())

            # Run indexer with shutdown handling
            indexer_task = asyncio.create_task(app.run())

            done, pending = await asyncio.wait(
                [shutdown_task, indexer_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel remaining tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        except Exception as e:
            console.print(f"[red]Application error: {e}[/red]")
            sys.exit(1)

    asyncio.run(run_async())


@cli.command()
@click.pass_context
def stats(ctx):
    """Show indexer statistics."""
    async def stats_async():
        app = IndexerApp()
        try:
            await app.initialize()
            await app.get_stats()
        except Exception as e:
            console.print(f"[red]Failed to get stats: {e}[/red]")
            sys.exit(1)
        finally:
            await app.shutdown()

    asyncio.run(stats_async())


@cli.command()
@click.option("--from-block", type=int, help="Start from specific block")
@click.pass_context
def watch(ctx, from_block):
    """Watch blockchain for events (one-time run)."""
    async def watch_async():
        app = IndexerApp()
        try:
            await app.initialize()

            if from_block:
                console.print(f"[blue]Watching from block {from_block}...[/blue]")
            else:
                console.print("[blue]Watching for new events...[/blue]")

            # For a one-time run, we could implement a limited watch here
            console.print("[yellow]One-time watch not implemented yet[/yellow]")

        except Exception as e:
            console.print(f"[red]Watch failed: {e}[/red]")
            sys.exit(1)
        finally:
            await app.shutdown()

    asyncio.run(watch_async())


if __name__ == "__main__":
    cli()
