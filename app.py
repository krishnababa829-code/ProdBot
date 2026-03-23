import os
import sys
import asyncio
import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from flow import run_happy_path, suggested_keywords

console = Console()

def get_trigger_keyword():
    return os.getenv("PRODBOT_TRIGGER_KEYWORD", "ignite")


async def launch(keyword: str | None):
    trigger = get_trigger_keyword()

    if keyword:
        if keyword == trigger:
            console.print(f"[yellow]Keyword '{keyword}' detected. Launching demo...[/yellow]")
            await run_happy_path()
        else:
            console.print(f"[red]Provided keyword '{keyword}' does not match trigger '{trigger}'. Exiting.[/red]")
        return

    console.print(Panel.fit("Type the trigger keyword to launch the demo", title="ProdBot"))
    try:
        typed = console.input(f"Trigger keyword (default: {trigger}): ").strip() or trigger
    except (EOFError, KeyboardInterrupt):
        console.print("\n[red]Input cancelled.[/red]")
        sys.exit(1)

    if typed == trigger:
        await run_happy_path()
    else:
        console.print(f"[red]Incorrect keyword '{typed}'. Exiting.")


@click.command()
@click.argument("keyword", required=False)
def cli(keyword: str | None):
    """ProdBot demo runner.

    OPTIONALLY pass KEYWORD directly to skip interactive prompt.
    """
    asyncio.run(launch(keyword))


@click.command()
def keywords():
    """Show suggested trigger keywords grouped by tone."""
    console.print(_keywords_table())


def _keywords_table():
    table = Table(title="Suggested trigger keywords")
    table.add_column("Category", style="cyan", justify="right")
    table.add_column("Examples", style="green")
    for category, words in suggested_keywords().items():
        table.add_row(category, ", ".join(words))
    return table


@click.group(invoke_without_command=True)
@click.option("--keyword", "keyword_opt", help="Trigger keyword to auto-launch the demo")
@click.pass_context
def main(ctx: click.Context, keyword_opt: str | None):
    if ctx.invoked_subcommand is None:
        asyncio.run(launch(keyword_opt))


main.add_command(cli, name="run")
main.add_command(keywords)


if __name__ == "__main__":
    main()
